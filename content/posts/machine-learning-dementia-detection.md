---
title: "Machine Learning for Early Dementia Detection: A Careful Guide"
date: 2026-06-02
description: "How machine learning for early dementia detection works: the data, why it is a screening aid not a diagnosis, patient leakage, SHAP and the ethics."
tags: [Healthcare AI, Machine Learning, Research]
---

The first dementia model I trained reported an accuracy that would have made a cardiologist blush. I remember staring at it and feeling, briefly, like a genius. Then I looked at the dataset and realised it contained several visits per patient, and that my random train/test split had put visit one of a patient in the training set and visit three of the same patient in the test set.

The model had not learned to detect dementia. It had learned to recognise people.

I have since co-authored a paper on early dementia detection with machine learning, presented at IEEE ICCCI 2023, which you can find under [publications](/#publications), and the lesson from that first mistake is the one I would put at the top of any such project. This post is the careful version of how machine learning for early dementia detection works: what goes in, what comes out, and why the phrase "screening aid" is doing a lot of work.

## What data goes into a dementia detection model

Most published work uses some combination of three kinds of tabular data, usually from longitudinal research cohorts such as OASIS or ADNI, which follow volunteers over years.

- **Cognitive assessments.** Scores from standardised tests such as the Mini-Mental State Examination (MMSE) or the Clinical Dementia Rating (CDR). These are numbers a clinician produced by asking the patient questions.
- **Demographics.** Age, sex, years of education, sometimes socioeconomic indicators. Education matters because it is associated with how well people perform on the tests regardless of pathology.
- **MRI-derived features.** Not the raw scan, but measurements extracted from it: estimated total intracranial volume, normalised whole-brain volume, sometimes hippocampal volume or cortical thickness. Atrophy in particular regions is a known correlate of the disease.

Some datasets add genetics, such as APOE genotype, or biomarkers from blood or cerebrospinal fluid. Deep learning on the raw MRI volumes exists too and is a different, much hungrier problem.

Notice something about the first bullet. The CDR is, in many datasets, essentially the label. A model that takes CDR as an input and predicts "demented" has been handed the answer sheet. Which features are legitimate inputs depends on what the model is meant to do: if the point is to flag people before a full clinical assessment, the model cannot assume it has the outputs of that assessment.

## Why this is a screening aid, not a diagnosis

Dementia is diagnosed clinically. A specialist integrates history, examination, cognitive testing, imaging, blood tests to exclude other causes, and time. A model that outputs a probability from a handful of numbers is not doing that and should not pretend to.

What a model can do is **triage**: given a large population and limited specialist capacity, suggest who might benefit from a fuller assessment sooner. That is valuable. It is also a completely different claim from "this person has dementia", and the two get confused in abstracts constantly.

The asymmetry of errors is the point. A false positive from a screening tool means an unnecessary appointment and some anxiety. A false negative means someone who might have benefited from early support does not get it. A model that is tuned for a flattering accuracy figure rather than for that trade-off is tuned for the wrong thing. The threshold should be chosen with clinicians, based on what happens downstream of a flag, not by whatever maximised F1 on the test set.

## Small datasets and class imbalance

Research cohorts contain hundreds or low thousands of participants, not millions. Within that, the number of people who actually convert from healthy to impaired during the study window is small. So you have a small dataset with a rare positive class, and that combination makes every evaluation number noisy.

Practical consequences:

- **Report uncertainty.** Cross-validated estimates with confidence intervals, not a single number from one lucky split. If you ran ten random seeds and reported the best, you have reported noise.
- **Handle imbalance honestly.** Class weights or threshold tuning are usually better than synthetic oversampling on clinical data, where inventing plausible fake patients is a strange thing to do.
- **Prefer simple models.** Logistic regression and gradient-boosted trees are competitive on a few hundred rows and far easier to explain than anything deeper. A deep network on three hundred patients is a memorisation device.
- **Beware the test set becoming the training set.** If you tune hyperparameters against it fifty times, it is no longer a test set.

If you want a general guide to reading these numbers sceptically, I wrote [how to read a machine learning paper](/blog/how-to-read-a-machine-learning-paper/) for exactly this purpose.

## Patient leakage: the bug that makes every paper look good

Back to my first model. Longitudinal datasets contain multiple rows per person, one per visit. Rows from the same person are far more similar to each other than to rows from anyone else: same sex, same education, similar brain volume, similar scores. If any of a patient's visits are in the training set, predicting their other visits is easy, and your model has learned identity rather than disease.

The fix is to split by patient, so every row belonging to one person lands entirely in train or entirely in test. In scikit-learn that is `GroupKFold`:

```python
from sklearn.model_selection import GroupKFold, cross_val_score
from sklearn.ensemble import GradientBoostingClassifier

# X: features per visit, y: label per visit, groups: patient ID per visit
gkf = GroupKFold(n_splits=5)
model = GradientBoostingClassifier(random_state=0)

scores = cross_val_score(model, X, y, groups=groups, cv=gkf, scoring="roc_auc")
print(scores.mean(), scores.std())
```

The `groups` argument is the entire difference between a defensible result and a spurious one. If you also want the class balance preserved per fold, `StratifiedGroupKFold` does both.

There is a second, subtler leak: preprocessing. If you standardise features or impute missing values using statistics computed on the full dataset before splitting, the test set has informed the training set. Put the preprocessing inside a `Pipeline` so it is fitted per fold.

## Interpretability: feature importance and SHAP

A clinician will not act on "the model said 0.71". They will act on "the model flagged this person mainly because of a drop in normalised brain volume between visits and a lower-than-expected score for their education level". That is the difference between interpretability as a checkbox and interpretability as something useful.

**Global feature importance**, from a tree model, tells you which features the model uses most across the dataset. It usually tells you that age and cognitive scores matter, which nobody needed a model to learn. It is a sanity check, not an insight.

**SHAP values** go per prediction. For each patient, each feature gets a contribution that pushes the output up or down from the baseline, and the contributions add up to the prediction. That gives you a per-patient explanation a clinician can argue with, which is the correct relationship to have with a model.

Two cautions. Correlated features share credit unpredictably, so "brain volume was not important" may just mean a correlated feature took its place. And an explanation of a wrong model is a fluent explanation of a wrong model. SHAP tells you what the model did, not whether it should have.

## Ethics, bias and regulation

This is where careful stops being a stylistic choice and becomes a requirement.

- **Cohort bias.** Research volunteers skew towards particular ages, education levels, ethnicities and countries. A model trained on them may perform worse on everyone else, and you will not know unless you test it on everyone else.
- **Feedback effects.** If a flag leads to earlier diagnosis in one group and not another, the model can widen an existing gap while looking fair on paper.
- **Regulation.** Software that informs clinical decisions is a medical device in the UK and EU. That means the MHRA, the EU Medical Device Regulation, clinical evaluation, post-market monitoring, and a lot of paperwork that a GitHub repository does not satisfy.
- **Clinical validation.** A retrospective score on a research cohort is a starting point. Prospective evaluation, in the setting where the tool will actually be used, is what would justify using it on real people.

A model that helps a clinician prioritise is a good thing to build. A model published with a headline accuracy and no discussion of any of the above is a good way to be cited and never used, which is the outcome most of this field achieves. It is also, for what it is worth, the reason [ML models are like toddlers](/blog/ml-models-are-like-toddlers/): they will find the shortcut if you leave it lying around.

## What to remember

- Inputs are cognitive scores, demographics and MRI-derived measurements; check which of them are secretly the label.
- The output is a screening prompt for further assessment, never a diagnosis. Choose the threshold with clinicians.
- Small, imbalanced datasets mean noisy numbers. Report intervals, prefer simple models.
- Split by patient with `GroupKFold`, and keep preprocessing inside the fold.
- Use SHAP for per-patient explanations, but remember it explains the model, not the disease.
- Bias, regulation and prospective validation are the work. The model is the easy part.

## Further reading

- [scikit-learn GroupKFold documentation](https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.GroupKFold.html) and the [cross-validation user guide](https://scikit-learn.org/stable/modules/cross_validation.html).
- [SHAP documentation](https://shap.readthedocs.io/).
- [MHRA guidance on software and AI as a medical device](https://www.gov.uk/government/publications/software-and-artificial-intelligence-ai-as-a-medical-device).

If you would like to see this done more carefully than my first attempt, the paper is under [publications](/#publications), and my first model has been quietly retired to a folder called `never_again`.
