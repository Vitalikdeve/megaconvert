# Web Features

Route-level feature modules for the web product.

Rules:
- feature folders own page composition for a product domain or route surface
- `shared/` owns cross-feature shell, state, motion, and foundation primitives
- `shared/state` separates durable UX preferences from transient interaction state
- infrastructure concerns stay in `src/lib` and `src/providers`, not in feature folders
- feature hooks should consume provider-backed service clients instead of constructing transport clients ad hoc
