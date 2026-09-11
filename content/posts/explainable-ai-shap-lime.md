---
title: "Explainable AI with SHAP and LIME: Defending a Model's Decision"
date: 2026-05-05
description: "Explainable AI for people who must defend a model's decision: feature importance, SHAP, LIME and Grad-CAM, and the pitfalls that make an explanation misleading."
tags: [AI, Machine Learning, Healthcare AI, Digital Forensics]
---

During my dementia detection work, a clinician looked at a prediction my model had made for one patient and asked a perfectly reasonable question: "Why?". I said the output probability was 0.83. She waited. I said the model had good validation accuracy. She waited a bit longer. Eventually I admitted that I did not know why, that nobody did, and that this was considered normal in my field.

It is considered normal. It should not be. If a screening tool flags a patient, or a forensic tool says an image is fake, someone will have to defend that decision to a doctor, a lawyer or a review board, and "the model said so" is not a defence. It is an admission.

This post is about explainable AI for people who are on the hook for a model's output: what global and local explanations are, how feature importance, SHAP, LIME and Grad-CAM work without drowning in maths, and the ways explanations go wrong.

## Why "the model said so" fails in healthcare and forensics

In most applications, a wrong prediction costs a click. In clinical screening it costs a missed diagnosis or an unnecessary scan. In digital forensics it costs someone's credibility, or their liberty, and the other side's expert gets to ask exactly how the tool reached its conclusion.

Explainability serves three different audiences at once:

- The **developer**, who needs to know whether the model learned the disease or learned the hospital's scanner model.
- The **domain expert**, who needs to check that the reasons make clinical or forensic sense.
- The **person affected**, who is entitled to something better than a number.

The same demand shows up when [evaluating a deepfake detector](/blog/how-to-spot-ai-generated-images/): a verdict without the signal that produced it is an opinion with a GPU. Explainability is how you turn the opinion into evidence.

## Global vs local explanations and feature importance

Two questions sound similar and are not:

1. **Globally**, what does this model rely on across all its predictions? This tells you what it has learned.
2. **Locally**, why did it produce this output for this input? This tells you what happened to one patient or one image.

A model can be globally sensible and locally absurd. A dementia classifier might, across the dataset, weight cognitive test scores heavily (good) while for one particular patient the prediction is driven entirely by age (less good). You need both views.

The simplest global explanation for tabular data is **feature importance**. Tree-based models give it away for free: how much did each feature reduce impurity across all the splits? It is quick and slightly misleading, because it favours features with many possible values and reflects what the model used, not what actually matters.

**Permutation importance** is the honest version. Take a trained model and a held-out set, shuffle one feature's column so it becomes noise, and measure how much the model's performance drops. A feature the model needs causes a big drop. A feature it ignores causes none. It is model-agnostic and it measures what you care about, which is the effect on real predictions. Its weakness is correlated features: if age and years-since-retirement are both in the data, shuffling one leaves the other to cover for it, and both look unimportant. Remember that; it comes back later.

## SHAP: sharing the credit fairly

SHAP (SHapley Additive exPlanations) answers the local question with an idea borrowed from game theory. Imagine the features are players in a team and the prediction is the team's winnings. Shapley values divide the winnings fairly, by asking, for each player, how much the outcome changed when they joined, averaged over every order they could have joined in.

For a model, that translates to: start from the average prediction, and attribute the difference between the average and this specific prediction to each feature, such that the contributions add up exactly. Feature X pushed the score up by 0.12, feature Y pulled it down by 0.05, and so on. Sum them, add the baseline, and you get the model's output. That additive property is what makes SHAP defensible in a room: the explanation accounts for the whole prediction, not a vague "these seemed relevant".

Computing exact Shapley values is exponential in general, but for tree ensembles there is an efficient exact algorithm, which is why the tree explainer is the one most people meet first:

```python
import shap
from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier(n_estimators=200, random_state=0)
model.fit(X_train, y_train)

explainer = shap.TreeExplainer(model)
sv = explainer(X_test)            # Explanation: (samples, features, classes)

# Global: which features drive the positive class across the test set
shap.plots.beeswarm(sv[:, :, 1])

# Local: why this one patient got this score
shap.plots.waterfall(sv[0, :, 1])
```

The beeswarm gives you the global picture (which features matter, and in which direction) and the waterfall gives you the local one for a single row. Aggregate the local values and you get a global explanation for free, which is the neat part.

## LIME: a local approximation you can read

LIME (Local Interpretable Model-agnostic Explanations) takes a different route to the same local question. It does not look inside the model at all. Instead, it takes the input you care about, generates many slightly perturbed versions of it, asks the black-box model to predict each one, and then fits a simple model (usually a weighted linear regression) to those predictions in the neighbourhood of the original input.

The simple model is the explanation. "Around this patient, the black box behaves roughly like 0.4 × memory score − 0.2 × age + …". It works on tabular data, text (perturb by removing words) and images (perturb by blanking out superpixels).

The price is stability. Because LIME samples randomly, running it twice can give two different explanations, and the choice of neighbourhood size changes the answer. That is uncomfortable if you are being cross-examined. I tend to use LIME to sanity-check what SHAP tells me rather than as the primary evidence.

## Saliency and Grad-CAM for images

For images there is no tidy feature list to attribute. What you can do is ask which pixels the model was sensitive to. A **saliency map** is the gradient of the output with respect to the input pixels: bright where a small change would move the prediction, dark where it would not. It is noisy and cheap.

**Grad-CAM** is the version people actually use. It takes the last convolutional layer's feature maps, weights each by how much it contributed to the class score, and produces a coarse heatmap over the image. For a deepfake detector, a good Grad-CAM lights up the eyes, teeth or hairline where generators struggle; a worrying one lights up the watermark in the corner or the background, which means the model has learned the dataset rather than the task. For a medical scan it should light up anatomy, not the label burned into the film.

Grad-CAM is also how I found out that one of my early [transfer learning](/blog/transfer-learning-explained/) models was classifying by image border. Humbling, and exactly what the tool is for.

## Pitfalls: explanations of a wrong model are still wrong

Explainability is not accuracy. A model that has learned a spurious shortcut will produce a clean, confident, additive explanation of that shortcut. SHAP will faithfully tell you the model is relying on the scanner ID, and it is your job to notice that this is bad. The explanation validates the model only if a human with domain knowledge reads it and is allowed to object.

The other traps:

- **Correlated features.** SHAP splits credit between correlated features in ways that depend on the background data; permutation importance hides them. Either way, "feature X is unimportant" may just mean "feature Y is standing in for it".
- **Out-of-distribution perturbations.** LIME and permutation methods create inputs the model has never seen (a 30-year-old with a retirement date), and the model's behaviour there is not evidence of anything.
- **Explanation as persuasion.** A heatmap looks authoritative. It is easy to pick the one that agrees with you. Decide the method and the presentation before you look at the results.
- **Explaining the wrong output.** Explain the probability or the logit, and say which; explaining a thresholded yes/no decision throws away most of the information.

## Why this matters for deepfake detectors and clinical tools

In both fields, the model is one piece of evidence weighed by a human who is accountable for the outcome. A clinical screening tool that reports "high risk, driven mainly by the delayed recall score and the estimated hippocampal volume" fits into how a clinician already reasons; the [dementia detection project](/blog/machine-learning-dementia-detection/) taught me that the explanation is often the part they actually want. A deepfake detector that reports "synthetic, driven by missing sensor noise and periodic frequency artefacts" is something an expert witness can stand behind and an opposing expert can test.

Neither is a black box any more. Both can still be wrong, but they are wrong in a way that can be argued about, which is the whole point. The [publications on the homepage](/#publications) lean on this idea more than I would have predicted when I started.

## What to remember

- "The model said so" fails wherever a person is accountable for the decision, which includes clinics and courtrooms.
- Global explanations say what the model learned; local ones say why it produced this output. You need both.
- Permutation importance beats built-in feature importance, but both struggle with correlated features.
- SHAP attributes a prediction to features so the contributions add up exactly; use the tree explainer for tree models.
- LIME is model-agnostic but unstable, and Grad-CAM shows where an image model looked, which is how you catch it staring at the watermark.
- An explanation of a wrong model is a well-explained wrong answer.

## Further reading

- [SHAP documentation](https://shap.readthedocs.io/) for the explainers, plots and the theory behind them.
- [scikit-learn permutation importance](https://scikit-learn.org/stable/modules/permutation_importance.html) for the model-agnostic global baseline.

The clinician, incidentally, was right to wait. I now build the explanation before the accuracy table, and the model is [still a toddler](/blog/ml-models-are-like-toddlers/), but at least it can now say which biscuit it wants.
