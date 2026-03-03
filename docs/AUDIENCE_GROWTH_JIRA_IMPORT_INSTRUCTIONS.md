# Audience Growth Jira Import Instructions

Files:
- `docs/AUDIENCE_GROWTH_EXECUTION_ISSUES.md`
- `docs/AUDIENCE_GROWTH_JIRA_IMPORT.csv`

Import steps:
1. Jira -> `Settings` -> `System` -> `External System Import` -> `CSV`.
2. Upload `docs/AUDIENCE_GROWTH_JIRA_IMPORT.csv`.
3. Map fields:
   - `Summary` -> Summary
   - `Issue Type` -> Issue Type
   - `Priority` -> Priority
   - `Description` -> Description
   - `Labels` -> Labels
   - `Story Points` -> Story Points custom field
4. Validate on preview.
5. Run final import.

Priority mapping:
- `Highest` => P0
- `High` => P1
- `Medium` => P2
