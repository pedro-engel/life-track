#!/usr/bin/env python3
"""
Running Plan Adaptation Agent
Reads running_plan_4days.xlsx, analyzes completed runs vs targets,
and adapts upcoming weeks via Claude Opus 5 coaching.
"""

import json
import os
import re
import sys

import openpyxl
from openpyxl.styles import Font
from anthropic import Anthropic

PLAN_FILE = "running_plan_4days.xlsx"
SHEET_NAME = "Plano 4 Dias"
MODEL = "claude-opus-5"
NUM_WEEKS = 20
ROWS_PER_WEEK = 11
WEEK_START_ROW = 5

# Row offsets within each week block (0-based from week header row)
ROW = {
    "header":     0,
    "data":       1,
    "tipo":       2,
    "km_alvo":    3,
    "ritmo_alvo": 4,
    "tempo_alvo": 5,
    "descricao":  6,
    "esteira_rua":7,
    "km_real":    8,
    "tempo_real": 9,
}

# Spreadsheet columns (1-based)
COL = {"label": 1, "monday": 2, "wednesday": 3, "thursday": 4, "friday": 5, "total": 6}
DAY_NAMES = ["monday", "wednesday", "thursday", "friday"]
DAY_LABELS = {"monday": "Segunda (LR)", "wednesday": "Quarta", "thursday": "Quinta (INT)", "friday": "Sexta (ER)"}


def cell_val(ws, row, col):
    v = ws.cell(row=row, column=col).value
    return str(v).strip() if v is not None and str(v).strip() not in ("None", "—") else ""


def parse_spreadsheet(filepath):
    wb = openpyxl.load_workbook(filepath)
    ws = wb[SHEET_NAME]
    weeks = []

    for wk in range(1, NUM_WEEKS + 1):
        base = WEEK_START_ROW + (wk - 1) * ROWS_PER_WEEK
        header_text = cell_val(ws, base + ROW["header"], 1)
        is_recovery = "RECUPERACAO" in header_text.upper()
        is_goal = "OBJETIVO" in header_text.upper()

        days = {}
        for day, col in [("monday", 2), ("wednesday", 3), ("thursday", 4), ("friday", 5)]:
            days[day] = {
                "date":        cell_val(ws, base + ROW["data"],       col),
                "type":        cell_val(ws, base + ROW["tipo"],       col),
                "km_target":   cell_val(ws, base + ROW["km_alvo"],    col),
                "pace_target": cell_val(ws, base + ROW["ritmo_alvo"], col),
                "time_target": cell_val(ws, base + ROW["tempo_alvo"], col),
                "description": cell_val(ws, base + ROW["descricao"],  col),
                "surface":     cell_val(ws, base + ROW["esteira_rua"],col),
                "km_actual":   cell_val(ws, base + ROW["km_real"],    col),
                "time_actual": cell_val(ws, base + ROW["tempo_real"], col),
            }

        weeks.append({
            "number":      wk,
            "start_row":   base,
            "header":      header_text,
            "is_recovery": is_recovery,
            "is_goal":     is_goal,
            "days":        days,
        })

    return wb, ws, weeks


def is_completed(week):
    return any(d["km_actual"] for d in week["days"].values())


def calc_pace(km_str, time_str):
    """Return 'M:SS' pace string from km and time strings, or None."""
    try:
        km = float(re.sub(r"[^\d.,]", "", km_str).replace(",", "."))
        parts = [int(x) for x in time_str.strip().split(":")]
        if len(parts) == 2:
            total_secs = parts[0] * 60 + parts[1]
        elif len(parts) == 3:
            total_secs = parts[0] * 3600 + parts[1] * 60 + parts[2]
        else:
            return None
        secs_per_km = total_secs / km
        m, s = divmod(int(secs_per_km), 60)
        return f"{m}:{s:02d}"
    except Exception:
        return None


def pace_secs(pace_str):
    """Convert 'M:SS/km' pace to total seconds, or None."""
    try:
        cleaned = re.sub(r"[^0-9:]", "", pace_str)
        parts = [int(x) for x in cleaned.split(":")]
        return parts[0] * 60 + parts[1]
    except Exception:
        return None


def performance_summary(weeks):
    """Build a human-readable summary of completed weeks."""
    lines = ["## TREINOS COMPLETADOS\n"]
    completed_weeks = [w for w in weeks if is_completed(w)]

    for week in completed_weeks:
        tag = " [RECUPERAÇÃO]" if week["is_recovery"] else ""
        lines.append(f"### Semana {week['number']}{tag}")

        for day in DAY_NAMES:
            d = week["days"][day]
            label = DAY_LABELS[day]

            if not d["km_actual"]:
                lines.append(f"  {label}: FALTOU (alvo: {d['km_target']})")
                continue

            actual_pace = calc_pace(d["km_actual"], d["time_actual"])
            target_raw = d["pace_target"].replace("/km", "").strip()
            note = ""

            if actual_pace and target_raw and target_raw.lower() not in ("livre (varia)", "livre", "intervalo"):
                t = pace_secs(target_raw)
                a = pace_secs(actual_pace)
                if t and a:
                    diff = a - t
                    if diff > 15:
                        note = f"  ⚠️  {diff}s/km mais lento que o alvo"
                    elif diff < -15:
                        note = f"  ✅ {abs(diff)}s/km mais rápido que o alvo"
                    else:
                        note = "  ✅ no ritmo alvo"

            lines.append(
                f"  {label}: {d['km_actual']} em {d['time_actual']}"
                f" | ritmo real: {actual_pace or '?'}/km | alvo: {d['pace_target']}{note}"
            )
        lines.append("")

    return "\n".join(lines)


def upcoming_snapshot(weeks, n=4):
    """JSON-serializable snapshot of next N upcoming weeks."""
    upcoming = [w for w in weeks if not is_completed(w)][:n]
    result = []
    for w in upcoming:
        result.append({
            "semana": w["number"],
            "is_recovery": w["is_recovery"],
            "is_goal": w["is_goal"],
            "days": {
                day: {
                    "type":        w["days"][day]["type"],
                    "km_target":   w["days"][day]["km_target"],
                    "pace_target": w["days"][day]["pace_target"],
                    "time_target": w["days"][day]["time_target"],
                    "description": w["days"][day]["description"],
                }
                for day in DAY_NAMES
            }
        })
    return result


def apply_adaptations(ws, weeks, adaptations):
    """Write Claude's adaptations into the spreadsheet. Returns count applied."""
    week_lookup = {w["number"]: w for w in weeks}
    field_map = {
        "km_target":   "km_alvo",
        "pace_target": "ritmo_alvo",
        "time_target": "tempo_alvo",
        "description": "descricao",
    }
    day_col = {"monday": 2, "wednesday": 3, "thursday": 4, "friday": 5}
    applied = 0

    for a in adaptations:
        wk_num = a.get("semana")
        day    = a.get("dia")
        field  = a.get("campo")
        value  = a.get("valor_novo")

        if wk_num not in week_lookup:
            print(f"  ⚠️  Semana {wk_num} não encontrada — ignorando")
            continue
        if day not in day_col:
            print(f"  ⚠️  Dia '{day}' inválido — ignorando")
            continue
        if field not in field_map:
            print(f"  ⚠️  Campo '{field}' inválido — ignorando")
            continue

        week = week_lookup[wk_num]
        if is_completed(week):
            print(f"  ⏭️  Semana {wk_num} já completada — pulando")
            continue

        row = week["start_row"] + ROW[field_map[field]]
        col = day_col[day]
        cell = ws.cell(row=row, column=col)
        cell.value = value
        cell.font = Font(name="Calibri", size=9, italic=True, color="1565C0")

        reason = a.get("razao", "")
        print(f"  ✅ Sem {wk_num} / {day} / {field}: '{value}'  — {reason}")
        applied += 1

    return applied


def main():
    print("AGENTE DE ADAPTAÇÃO DO PLANO DE CORRIDA")
    print("=" * 50)

    if not os.path.exists(PLAN_FILE):
        print(f"Arquivo não encontrado: {PLAN_FILE}")
        sys.exit(1)

    print(f"\nLendo {PLAN_FILE}...")
    wb, ws, weeks = parse_spreadsheet(PLAN_FILE)

    completed = [w for w in weeks if is_completed(w)]
    upcoming  = [w for w in weeks if not is_completed(w)]

    if not completed:
        print("Nenhum treino registrado ainda.")
        print("Preencha 'KM Real' e 'Tempo Real' na planilha e execute novamente.")
        sys.exit(0)

    print(f"Semanas completadas : {[w['number'] for w in completed]}")
    print(f"Próximas semanas    : {[w['number'] for w in upcoming[:4]]}")

    perf = performance_summary(weeks)
    upcoming_plan = upcoming_snapshot(weeks, n=4)

    print(f"\nAnalisando com {MODEL}...")

    prompt = f"""Você é um treinador de corrida especializado. Analise os dados abaixo e adapte o plano.

{perf}

## PRÓXIMAS SEMANAS PLANEJADAS

{json.dumps(upcoming_plan, ensure_ascii=False, indent=2)}

## OBJETIVO DO CORREDOR
Correr 10 km em 60 minutos (6:00/km) até Dezembro 2026.
Nível atual: capaz de correr ~5 km a 6:00/km.

## REGRAS DE ADAPTAÇÃO
- Se o corredor está consistentemente >15s/km mais lento que o alvo nas corridas fáceis (LR/ER):
  sugira ritmos-alvo ligeiramente mais conservadores nas próximas 1-2 semanas
- Se está no ritmo ou mais rápido: mantenha progressão normal
- Se faltou treinos: considere reduzir volume semanal
- Semanas de recuperação (is_recovery=true) NÃO devem ser intensificadas
- Semana do objetivo (is_goal=true) NÃO deve ser alterada

## FORMATO DE RESPOSTA
Responda APENAS em JSON válido, sem markdown, sem texto antes ou depois:

{{
  "analise": "análise em 2-3 parágrafos em português",
  "adaptacoes": [
    {{
      "semana": <número>,
      "dia": "monday|wednesday|thursday|friday",
      "campo": "km_target|pace_target|time_target|description",
      "valor_novo": "<string exatamente como aparece na planilha>",
      "razao": "<justificativa breve>"
    }}
  ],
  "mensagem_motivacional": "<frase curta de encorajamento>"
}}

Se não houver adaptações necessárias, retorne "adaptacoes": [].
Não altere semanas já completadas.
Não altere semanas de recuperação ou do objetivo."""

    client = Anthropic()

    with client.messages.stream(
        model=MODEL,
        max_tokens=4096,
        thinking={"type": "adaptive"},
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        response = stream.get_final_message()

    raw = ""
    for block in response.content:
        if block.type == "text":
            raw = block.text
            break

    # Extract JSON (strip any accidental markdown fences)
    json_match = re.search(r"\{[\s\S]*\}", raw)
    if not json_match:
        print("\nNão foi possível extrair JSON da resposta.")
        print("Resposta bruta:", raw[:800])
        sys.exit(1)

    try:
        result = json.loads(json_match.group())
    except json.JSONDecodeError as e:
        print(f"\nErro ao parsear JSON: {e}")
        print("Trecho:", raw[:800])
        sys.exit(1)

    print("\n" + "=" * 50)
    print("ANÁLISE DO TREINADOR")
    print("=" * 50)
    print(result.get("analise", ""))

    adaptations = result.get("adaptacoes", [])
    print(f"\nAdaptações sugeridas: {len(adaptations)}")

    if not adaptations:
        print("Nenhuma alteração necessária — continue o plano como está.")
    else:
        applied = apply_adaptations(ws, weeks, adaptations)
        if applied:
            try:
                wb.save(PLAN_FILE)
                print(f"\nPlanilha salva com {applied} adaptação(ões) (texto em azul itálico).")
            except PermissionError:
                print(f"\nErro: feche o arquivo {PLAN_FILE} no Excel e execute novamente.")
                sys.exit(1)
        else:
            print("\nNenhuma adaptação aplicada.")

    print("\n" + result.get("mensagem_motivacional", "Continue firme!"))
    print()


if __name__ == "__main__":
    main()
