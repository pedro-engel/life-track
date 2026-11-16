"""Pure-function logic for the training cycle pointer."""
from __future__ import annotations


def next_pointer(current: int, completed_position: int | None, length: int) -> int:
    """Advance the cycle pointer.

    Args:
        current: The current pointer value.
        completed_position: The position of the completed step.  May be ``None``
            to advance from the current position regardless of which step was
            completed.
        length: Total number of steps in the cycle.

    Returns:
        The new pointer value, wrapping to 0 after the last step.

    Algorithm::

        base = completed_position if completed_position is not None else current
        return (base + 1) % length
    """
    base = completed_position if completed_position is not None else current
    return (base + 1) % length
