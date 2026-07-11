Menu drink card from the results screen — thumbnail tile, serif name, stars, description, price pill. Composes StarRating + PricePill.

```jsx
<DrinkCard
  image="assets/drink-aperol-spritz.png"
  name="Aperol Spritz"
  rating={5}
  description="Refreshing with prosecco and orange"
  price="$14"
/>
```

Stack cards vertically with `gap: var(--card-gap)` on a `var(--bg-app)` screen.
