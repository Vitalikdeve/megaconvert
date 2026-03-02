# Jira Import Instructions (Platform Backlog S1-S6)

## Files

- Backlog CSV: `docs/JIRA_IMPORT_PLATFORM_BACKLOG.csv`
- Source docs: `docs/SPRINT1_EXECUTION_ISSUES.md` ... `docs/SPRINT6_EXECUTION_ISSUES.md`

## CSV Columns

- `Summary`
- `Issue Type`
- `Priority`
- `Description`
- `Labels`
- `Story Points`

## Jira Import Steps

1. Open Jira: `Settings -> System -> External System Import -> CSV`.
2. Upload `docs/JIRA_IMPORT_PLATFORM_BACKLOG.csv`.
3. Select target project and issue type mapping (`Task`).
4. Map fields:
   - `Summary` -> Summary
   - `Description` -> Description
   - `Priority` -> Priority
   - `Labels` -> Labels
   - `Story Points` -> Story points (custom field, if configured)
5. Run import in dry-run/preview mode.
6. Validate sample of imported issues:
   - ticket IDs in summary (`S1-001...S6-010`)
   - labels by sprint
   - acceptance criteria in description
7. Complete final import.

## Notes

- If your Jira instance uses a different field name for story points, remap `Story Points` manually during import.
- If priorities differ by scheme, map:
  - `Highest` -> equivalent of P0
  - `High` -> equivalent of P1
  - `Medium` -> equivalent of P2
