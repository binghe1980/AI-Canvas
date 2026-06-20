# Annotation Rules

- Prefer the selected `ai_image` as the target.
- If nothing is selected, use explicit arrow bindings when available.
- If there is one AI image on the page, use it.
- If several images are possible, choose the closest high-confidence annotation target or ask for clarification.
- Arrow tips define the edit region; nearby text defines the instruction.
- Circle, rectangle, and freehand marks define a region by intersection with the image.
- Convert all regions to relative image coordinates clamped to `[0, 1]`.
- Low confidence means no target, multiple likely targets, unclear text, conflicting marks, or annotations outside the image.
