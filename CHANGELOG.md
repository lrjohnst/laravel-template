# Changelog — laravel-template

---

## 2026-08-02

### Harmonisatie met standaarden

- `lrjohnst/laravel-ui-theme` package toegevoegd (path repository)
- Layout: @vite() vervangen door directe CSS-links (theme.css + app.css)
- SSO middleware volledig geconfigureerd in bootstrap/app.php
- .env.example: UI_PRIMARY/UI_PRIMARY_DARK/UI_ACCENT/UI_BG variabelen
- config/ui-theme.php, public/css/theme.css en app.css toegevoegd
- User model opgeschoond (app-specifieke relaties verwijderd)
- Vite/Tailwind dependencies verwijderd (Blade-sites gebruiken statische CSS)

---

## 2026-08-01

### Template aangemaakt

- Herbruikbare template aangemaakt in `/home/lrjohnst/repositories/laravel-template`
- Generieke layout, .env.example, ai-studio-chat config
- README met stap-voor-stap setup instructies voor nieuwe apps
- GitHub: https://github.com/lrjohnst/laravel-template
