# Core module rules for Cloud Agents

- All calculation logic belongs in `src/core/`. Never duplicate formulas in `ui/`.
- `core/` must not import PySide6 or any networking library.
- Every approximation or fallback must be visible in UI and recorded in output data.
- Erlang C rows must show exactly 0% abandonment.
- Date parsing must use `core.datetime.parser` exclusively.
