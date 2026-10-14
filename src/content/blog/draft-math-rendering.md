---
title: 'Writing math'
description: 'Unpublished sample of inline and display LaTeX. Kept as a draft so it does not ship.'
date: 2026-10-14
draft: true
tags:
  - writing
---

Inline math stays in the sentence. Energy and mass are related by $E = mc^2$, and a Gaussian integral is $\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}$.

Display math is a `$$` fence with the formula on its own lines:

$$
i\hbar\frac{\partial}{\partial t}\Psi(\mathbf{r},t) = \left[-\frac{\hbar^2}{2m}\nabla^2 + V(\mathbf{r},t)\right]\Psi(\mathbf{r},t)
$$

A long formula scrolls sideways on a narrow screen instead of spilling out of the article:

$$
\sigma = \sqrt{\frac{1}{N}\sum_{i=1}^{N}(x_i - \mu)^2} = \sqrt{\frac{(x_1 - \mu)^2 + (x_2 - \mu)^2 + \cdots + (x_N - \mu)^2}{N}}
$$

Literal prices keep their dollar signs when they are escaped: a notebook costs \$12 and a pen costs \$2. A single price such as $4 is already left as text.

Dollars inside code are not rendered as math.

```js
const price = `$${amount}`;
const formula = '$E = mc^2$';
```

Inline code such as `$E = mc^2$` stays literal too.
