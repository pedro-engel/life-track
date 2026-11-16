import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from datetime import date, timedelta

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Plano 4 Dias"

def fill(c):
    return PatternFill(start_color=c, end_color=c, fill_type="solid")

def fnt(bold=False, sz=10, color="000000", italic=False):
    return Font(name="Calibri", bold=bold, size=sz, color=color, italic=italic)

def aln(h="center", v="center", wrap=False):
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def bdr(style="thin", color="CCCCCC"):
    s = Side(style=style, color=color)
    return Border(left=s, right=s, top=s, bottom=s)

def time_str(km, pace):
    try:
        m, s = [int(x) for x in pace.split(":")]
        tot = int(km * (m * 60 + s))
        h, rem = divmod(tot, 3600)
        mm, ss = divmod(rem, 60)
        return f"{h}:{mm:02d}:{ss:02d}" if h else f"{mm}:{ss:02d}"
    except:
        return "—"

TYPE_BG   = {"LR":"BDE0F5","INT":"FDDDE6","TEMPO":"FEECCD","FARK":"EDE0FA","PROG":"D5F5E3","ER":"E8F5E9","STRIDES":"FFF9C4"}
TYPE_DARK = {"LR":"1565C0","INT":"B71C1C","TEMPO":"E65100","FARK":"6A1B9A","PROG":"1B5E20","ER":"1B5E20","STRIDES":"F57F17"}
TYPE_NAME = {"LR":"Corrida Longa","INT":"Intervalos","TEMPO":"Tempo Run","FARK":"Fartlek","PROG":"Progressiva","ER":"Corrida Leve","STRIDES":"Strides"}
DAYS_PT   = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"]

def fmt_date(d):
    return f"{d.strftime('%d/%m')} ({DAYS_PT[d.weekday()]})"

ws.column_dimensions['A'].width = 15
ws.column_dimensions['B'].width = 32
ws.column_dimensions['C'].width = 30
ws.column_dimensions['D'].width = 36
ws.column_dimensions['E'].width = 26
ws.column_dimensions['F'].width = 12
ws.freeze_panes = "A5"

# Title
ws.merge_cells('A1:F1')
c = ws['A1']
c.value = "PLANO DE CORRIDA — 4 DIAS POR SEMANA"
c.fill = fill("1E3A5F"); c.font = fnt(bold=True, sz=15, color="FFFFFF"); c.alignment = aln()
ws.row_dimensions[1].height = 36

ws.merge_cells('A2:F2')
c = ws['A2']
c.value = "Objetivo: 10km em 60min (6:00/km) até Dezembro 2026  |  2ª (LR) · 4ª (técnica) · 5ª (INT) · 6ª (ER)"
c.fill = fill("2D4A6E"); c.font = fnt(sz=10, color="C9DEFF", italic=True); c.alignment = aln()
ws.row_dimensions[2].height = 20

ws.row_dimensions[3].height = 6

for i, h in enumerate(["CAMPO","SEGUNDA (LR)","QUARTA","QUINTA (INT)","SEXTA (ER)","TOTAL KM"], 1):
    c = ws.cell(row=4, column=i, value=h)
    c.fill = fill("37474F"); c.font = fnt(bold=True, sz=10, color="FFFFFF")
    c.alignment = aln(); c.border = bdr("medium","000000")
ws.row_dimensions[4].height = 22

# (wk, rec, goal, lr_km, lr_pace, wed_type, wed_km, wed_pace, wed_desc, int_km, int_desc, fri_km, fri_pace)
WEEKS = [
(1, False,False, 7.0,"6:40","ER",   4.0,"6:40","Corrida leve — ritmo conversacional",                    4.0,"6x400m @12.0km/h | 90s caminhada",                 3.0,"6:40"),
(2, False,False, 7.5,"6:40","TEMPO",4.5,"5:30","20min a ritmo sustentado (5:30/km)",                      4.5,"6x400m @12.5km/h | 90s caminhada",                 3.5,"6:40"),
(3, False,False, 8.0,"6:35","FARK", 5.0,"livre","Fartlek: 1min rápido / 2min leve × 6 blocos",           5.0,"8x400m @13.0km/h | 90s caminhada",                 4.0,"6:40"),
(4, True, False, 6.0,"6:45","ER",   3.5,"6:45","RECUPERACAO — corrida leve, sem pressao",                3.5,"5x400m @12.0km/h | semana recuperacao",            3.0,"6:45"),
(5, False,False, 8.5,"6:35","PROG", 5.0,"6:30","Progressiva: comece 6:35, termine 5:50/km",              5.0,"3x800m @12.5km/h | 2min caminhada",                4.0,"6:35"),
(6, False,False, 9.0,"6:30","TEMPO",5.0,"5:25","25min a ritmo sustentado (5:25/km)",                      5.5,"4x800m @13.0km/h | 2min caminhada",                4.0,"6:35"),
(7, False,False, 9.5,"6:30","FARK", 5.5,"livre","Fartlek: 2min rapido / 2min leve × 6 blocos",           5.5,"4x800m + 2x400m @13.0km/h | 90s caminhada",       4.5,"6:35"),
(8, True, False, 7.0,"6:45","ER",   4.0,"6:45","RECUPERACAO — corrida leve, sem pressao",                4.0,"6x400m @12.5km/h | semana recuperacao",            3.0,"6:45"),
(9, False,False,10.0,"6:25","TEMPO",5.5,"5:20","25min a ritmo sustentado (5:20/km)",                      6.0,"5x800m @13.0km/h | 2min caminhada",                4.5,"6:30"),
(10,False,False,10.0,"6:20","PROG", 6.0,"6:20","Progressiva: comece 6:20, termine 5:40/km",              6.0,"4x800m + 2x400m @13.5km/h | 90s caminhada",       5.0,"6:30"),
(11,False,False,10.0,"6:20","FARK", 6.0,"livre","Fartlek: 2min rapido / 2min leve × 8 blocos",           6.0,"3x1km @12.5km/h | 2min caminhada",                 5.0,"6:30"),
(12,True, False, 8.0,"6:30","ER",   4.5,"6:30","RECUPERACAO — corrida leve, sem pressao",                4.5,"6x400m @13.0km/h | semana recuperacao",            3.5,"6:35"),
(13,False,False,10.0,"6:15","TEMPO",6.0,"5:15","25min a ritmo sustentado (5:15/km)",                      6.0,"4x1km @12.5km/h | 2min caminhada",                 5.0,"6:25"),
(14,False,False,10.0,"6:15","PROG", 6.0,"6:15","Progressiva: comece 6:15, termine 5:35/km",              6.0,"3x1km + 3x400m @13.5km/h | 90s caminhada",        5.0,"6:25"),
(15,False,False,10.0,"6:10","FARK", 6.0,"livre","Fartlek: 3min rapido / 2min leve × 6 blocos",           6.0,"5x1km @13.0km/h | 2min caminhada",                 5.0,"6:25"),
(16,True, False, 8.0,"6:20","ER",   4.5,"6:30","RECUPERACAO — corrida leve, sem pressao",                4.5,"5x400m @13.0km/h | semana recuperacao",            3.5,"6:30"),
(17,False,False,10.0,"6:10","TEMPO",5.5,"5:10","20min a ritmo sustentado (5:10/km) — inicio taper",      5.0,"4x1km @13.0km/h | 2min caminhada — taper",        4.0,"6:20"),
(18,False,False,10.0,"6:05","PROG", 5.0,"6:10","Progressiva: 6:10 ate 5:40/km — taper",                  4.5,"3x1km @13.0km/h — taper",                          3.5,"6:20"),
(19,False,True, 10.0,"6:00","ER",   4.0,"6:20","Corrida leve — conserva energia pre-teste",              3.0,"10x20s strides no final — taper final",             3.0,"6:20"),
(20,False,False, 6.0,"6:20","ER",   3.0,"6:30","Corrida leve pos-objetivo",                               3.0,"Corrida leve de celebracao!",                       3.0,"6:30"),
]

ROW_LABELS = ["Data","Tipo","KM Alvo","Ritmo Alvo","Tempo Alvo","Descricao","Esteira/Rua","KM Real","Tempo Real"]

start_date = date(2026, 8, 17)
current_row = 5

for wk, rec, goal, lr_km, lr_pace, wed_type, wed_km, wed_pace, wed_desc, int_km, int_desc, fri_km, fri_pace in WEEKS:
    mon = start_date + timedelta(weeks=wk-1)
    wed = mon + timedelta(days=2)
    thu = mon + timedelta(days=3)
    fri = mon + timedelta(days=4)
    total_km = lr_km + wed_km + int_km + fri_km

    if goal:
        hbg, htxt = "F9A825", "000000"
        hlabel = f"SEMANA {wk}  |  {mon.strftime('%d/%m')} – {fri.strftime('%d/%m/%Y')}   *** SEMANA DO OBJETIVO — TESTE DE 10KM! ***"
    elif rec:
        hbg, htxt = "E65100", "FFFFFF"
        hlabel = f"SEMANA {wk}  |  {mon.strftime('%d/%m')} – {fri.strftime('%d/%m/%Y')}   [ SEMANA DE RECUPERACAO ]"
    else:
        hbg, htxt = "263238", "FFFFFF"
        hlabel = f"SEMANA {wk}  |  {mon.strftime('%d/%m')} – {fri.strftime('%d/%m/%Y')}"

    ws.merge_cells(f'A{current_row}:F{current_row}')
    c = ws[f'A{current_row}']
    c.value = hlabel; c.fill = fill(hbg); c.font = fnt(bold=True, sz=11, color=htxt)
    c.alignment = aln(h="left"); c.border = bdr("medium","000000")
    ws.row_dimensions[current_row].height = 20
    current_row += 1

    if goal:
        mon_desc = "TESTE FINAL! Corra 10km a 6:00/km. Meta: terminar em 60:00 ou menos."
    else:
        mon_desc = "Corrida Longa — ritmo lento e constante, base aerobica"

    thu_type = "STRIDES" if goal else ("ER" if rec else "INT")

    row_vals = {
        "Data":       [fmt_date(mon), fmt_date(wed), fmt_date(thu), fmt_date(fri), ""],
        "Tipo":       [f"LR — {TYPE_NAME['LR']}", f"{wed_type} — {TYPE_NAME[wed_type]}", f"{thu_type} — {TYPE_NAME[thu_type]}", f"ER — {TYPE_NAME['ER']}", ""],
        "KM Alvo":    [f"{lr_km} km", f"{wed_km} km", f"{int_km} km", f"{fri_km} km", f"{total_km:.1f} km"],
        "Ritmo Alvo": [f"{lr_pace}/km", f"{wed_pace}/km" if wed_pace!="livre" else "Livre (varia)", "Intervalo", f"{fri_pace}/km", ""],
        "Tempo Alvo": [time_str(lr_km, lr_pace), time_str(wed_km, wed_pace) if wed_pace!="livre" else "~30-40min", "~30-35min", time_str(fri_km, fri_pace), ""],
        "Descricao":  [mon_desc, wed_desc, int_desc, "Corrida leve — recuperacao ativa", ""],
        "Esteira/Rua":["", "", "", "", ""],
        "KM Real":    ["", "", "", "", ""],
        "Tempo Real": ["", "", "", "", ""],
    }

    col_types = ["LR", wed_type, thu_type, "ER"]

    for label in ROW_LABELS:
        vals = row_vals[label]
        c = ws.cell(row=current_row, column=1, value=label)
        c.fill = fill("ECEFF1"); c.font = fnt(bold=True, sz=9, color="455A64")
        c.alignment = aln(h="right"); c.border = bdr()

        for ci, (val, t) in enumerate(zip(vals[:4], col_types), 2):
            cell = ws.cell(row=current_row, column=ci, value=val)
            cell.border = bdr()
            if label in ("KM Real","Tempo Real","Esteira/Rua"):
                cell.fill = fill("FAFAFA"); cell.font = fnt(sz=9, color="999999", italic=True)
                cell.alignment = aln()
            elif label == "Tipo":
                cell.fill = fill(TYPE_BG.get(t,"FFFFFF"))
                cell.font = fnt(bold=True, sz=9, color=TYPE_DARK.get(t,"000000"))
                cell.alignment = aln()
            elif label == "KM Alvo":
                cell.fill = fill(TYPE_BG.get(t,"FFFFFF"))
                cell.font = fnt(bold=True, sz=11, color=TYPE_DARK.get(t,"000000"))
                cell.alignment = aln()
            elif label == "Descricao":
                cell.fill = fill(TYPE_BG.get(t,"FFFFFF"))
                cell.font = fnt(sz=9, italic=True)
                cell.alignment = aln(h="left", wrap=True)
            else:
                cell.fill = fill(TYPE_BG.get(t,"FFFFFF"))
                cell.font = fnt(sz=9)
                cell.alignment = aln()

        # Total column
        tc = ws.cell(row=current_row, column=6, value=vals[4] if vals[4] else "")
        if label == "KM Alvo":
            tc.fill = fill("E8EAF6"); tc.font = fnt(bold=True, sz=11, color="283593")
        elif label == "KM Real":
            tc.fill = fill("FAFAFA"); tc.font = fnt(sz=9, color="999999")
        else:
            tc.fill = fill("F5F5F5"); tc.font = fnt(sz=9)
        tc.alignment = aln(); tc.border = bdr()

        ws.row_dimensions[current_row].height = 38 if label == "Descricao" else 18
        current_row += 1

    ws.row_dimensions[current_row].height = 8
    current_row += 1

# ─── Techniques Sheet ──────────────────────────────────────────────────────────
ws2 = wb.create_sheet("Tecnicas e Legenda")
ws2.column_dimensions['A'].width = 14
ws2.column_dimensions['B'].width = 20
ws2.column_dimensions['C'].width = 58
ws2.column_dimensions['D'].width = 28

ws2.merge_cells('A1:D1')
c = ws2['A1']; c.value = "TIPOS DE TREINO — TECNICAS DE CORRIDA"
c.fill = fill("1E3A5F"); c.font = fnt(bold=True, sz=14, color="FFFFFF"); c.alignment = aln()
ws2.row_dimensions[1].height = 32

ws2.merge_cells('A2:D2')
c = ws2['A2']
c.value = "Analise das suas corridas: Ritmo facil ja e 6:00-6:30/km. Principal desafio: construir distancia ate 10km mantendo o ritmo."
c.fill = fill("E3F2FD"); c.font = fnt(sz=10, italic=True, color="0D47A1"); c.alignment = aln(h="left", wrap=True)
ws2.row_dimensions[2].height = 32

for i, h in enumerate(["Codigo","Nome","Descricao e Como Executar","Quando / Por que"], 1):
    c = ws2.cell(row=4, column=i, value=h)
    c.fill = fill("37474F"); c.font = fnt(bold=True, sz=10, color="FFFFFF")
    c.alignment = aln(); c.border = bdr("medium","000000")
ws2.row_dimensions[4].height = 22

techs = [
    ("LR","Corrida Longa",
     "Ritmo muito lento (6:30-6:45/km) — voce deve conseguir falar em frases completas. Nao ha ritmo 'lento demais' aqui. Constroi base aerobica, resistencia muscular e capacidade de correr 10km. Aumente 10% por semana no maximo.",
     "Segunda-feira | 1x/semana | Base do plano"),
    ("ER","Corrida Leve",
     "Ritmo conversacional facil (6:30-6:45/km). Objetivo: recuperacao ativa e manutencao do volume sem acumular fadiga. Se sentir dificuldade para falar, esta rapido demais. 60-70% da frequencia cardiaca maxima.",
     "Quarta (alternando) e Sexta"),
    ("INT","Intervalos",
     "Aquecimento 1km facil → series de 400m ou 800m em ritmo forte → desaquecimento 1km. Entre cada serie: caminhe 90s-2min. Melhora VO2max, cadencia e eficiencia. Nao va rapido demais nas primeiras series — o ritmo deve ser igual em todas.",
     "Quinta-feira | 1x/semana | Velocidade"),
    ("TEMPO","Tempo Run",
     "20-25 minutos continuos a ritmo 'desconfortavelmente confortavel' (5:10-5:30/km). Voce consegue dizer algumas palavras mas nao frases. Eleva o limiar anaerobico — o ponto onde acumula lactato. E o treino mais eficiente para melhorar o ritmo de 10km.",
     "Quarta (alternando) | Limiar lactato"),
    ("FARK","Fartlek",
     "Do sueco 'jogo de velocidade'. Corra continuo, mas insira blocos de aceleracao espontanea: 1-3min rapido seguido de 2min leve. Nao para, apenas muda o ritmo. Ex: 1min @5:00/km, 2min @6:30/km, repetir 6-8x. Desenvolve a capacidade de variar ritmo.",
     "Quarta (alternando) | Versatilidade"),
    ("PROG","Progressiva",
     "Comeca no ritmo leve (6:30/km) e acelera gradualmente a cada km, terminando no ritmo de tempo (5:35-5:50/km). Simula o esforco crescente de uma corrida de 10km real. Ensina o corpo a correr mais rapido no final quando esta cansado.",
     "Quarta (alternando) | Especificidade"),
    ("STRIDES","Strides",
     "Ao final de uma corrida leve: 10x20-30 segundos de aceleracao suave (nao sprint maximo), com 1min de caminhada entre cada. Melhora cadencia, mecanica e neuromuscular sem acumular fadiga. Usado nas semanas de taper para manter o ritmo.",
     "Semanas de taper (semana 19)"),
]

for ri, (code, name, desc, when) in enumerate(techs, 5):
    bg = TYPE_BG.get(code, "FFFFFF")
    dk = TYPE_DARK.get(code, "000000")
    for ci, val in enumerate([code, name, desc, when], 1):
        c = ws2.cell(row=ri, column=ci, value=val)
        c.fill = fill(bg); c.border = bdr()
        if ci == 1:
            c.font = fnt(bold=True, sz=12, color=dk); c.alignment = aln()
        elif ci == 2:
            c.font = fnt(bold=True, sz=10, color=dk); c.alignment = aln()
        else:
            c.font = fnt(sz=9); c.alignment = aln(h="left", v="top", wrap=True)
    ws2.row_dimensions[ri].height = 60

tip_row = len(techs) + 7
ws2.merge_cells(f'A{tip_row}:D{tip_row}')
c = ws2[f'A{tip_row}']; c.value = "DICAS PARA MANTER A CONSISTENCIA"
c.fill = fill("1E3A5F"); c.font = fnt(bold=True, sz=12, color="FFFFFF"); c.alignment = aln()
ws2.row_dimensions[tip_row].height = 28

tips = [
    "Nunca aumente o volume semanal mais de 10% — a 'regra dos 10%' previne lesoes",
    "Se sentir dor (nao desconforto), pare e descanse 1-2 dias. Lesao = meses perdidos",
    "A corrida longa deve parecer facil demais — isso e correto. Ritmo lento = adaptacao real",
    "Durma 7-9h: a adaptacao ocorre durante o descanso, nao durante o treino",
    "Apos cada treino: anote km real, tempo real e como se sentiu (1-5). Padrao = progresso visivel",
    "Nas semanas de recuperacao (4, 8, 12, 16): reduza sem culpa. E parte do plano, nao fraqueza",
    "Voce ja corre 5km a 6:00/km. O objetivo e fazer 10km no mesmo ritmo — construcao de base!",
]

for i, tip in enumerate(tips):
    r = tip_row + 1 + i
    ws2.merge_cells(f'A{r}:D{r}')
    c = ws2.cell(row=r, column=1, value=f"  {chr(9679)}  {tip}")
    c.fill = fill("F8F9FA" if i % 2 == 0 else "FFFFFF")
    c.font = fnt(sz=10); c.alignment = aln(h="left", wrap=True)
    c.border = bdr(); ws2.row_dimensions[r].height = 26

wb.save("running_plan_4days.xlsx")
print("Saved: running_plan_4days.xlsx")
