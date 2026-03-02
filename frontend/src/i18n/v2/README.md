# i18n v2 Architecture

Structure:

```text
i18n/v2/
  manifest.json
  common.json
  upload.json
  ai.json
  errors.json
  admin.json
```

Runtime resolution order:

1. URL prefix locale
2. user setting
3. browser locale
4. fallback `en`

Supports RTL via document `dir` switch for Arabic.

