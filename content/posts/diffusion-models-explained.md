---
title: "Diffusion Models Explained: How AI Image Generators Actually Work"
date: 2026-04-21
description: "Diffusion models explained: forward noising, learned denoising, text conditioning and latent diffusion turn static into images, and why they leave traces."
tags: [AI, Deep Learning, Computer Vision, Deepfakes]
---

Picture a team that wants to know how the image generator in their new marketing tool works. The vendor's answer is "AI". The slightly longer vendor answer is "advanced generative AI". Nobody asks a third time.

The honest answer is stranger. The model was trained to remove noise from photographs, and if you hand it pure television static and ask it to remove the noise, it will politely hallucinate a photograph that was never there.

That is the entire idea behind diffusion models, and once you see it, the odd behaviour of AI image generators, from mangled hands to detectable fingerprints, starts to make sense.

## Forward noising and learned denoising

Training starts with something that looks like vandalism. Take a real image and add a little random noise. Then a little more. Repeat, say, a thousand times until it is indistinguishable from static. This forward process involves no learning at all.

Each step is small, so "slightly grainy cat" back to "grainy cat" is easy to undo, while "static" back to "cat" is not. Breaking the destruction into tiny steps turns one impossible problem into a thousand manageable ones.

The network is then trained on a single, dull task: given a noisy image and the step number, predict the noise that was added. Because the training set contains millions of real images at every noise level, the network develops a very good statistical sense of what real images look like under grain: edges continue, skin has texture, skies are brighter at the top.

## Generating means denoising from static

Now run the whole thing backwards. Start with pure random noise. Ask the network what the noise is, subtract a bit of it, and repeat. After a few dozen steps you have an image.

The network never saw this image; it learnt the shape of "plausible" from millions of others and walked downhill towards it from a random start. The loop is almost insultingly short:

```python
x = random_noise()
for t in reversed(range(steps)):
    predicted_noise = model(x, t, text_embedding)
    x = remove_some_noise(x, predicted_noise, t)
return x
```

## Text conditioning: how "a cat in a top hat" gets in

To steer the denoiser, the prompt is run through a text encoder, a separate model trained to map captions into the same kind of vector space as images, so that "cat" the word sits near cat the picture.

That text embedding is fed into the denoiser at every step, so the network's idea of "plausible" becomes "plausible given this caption". A trick called classifier-free guidance pushes harder: the model predicts the noise with the prompt and without it, then exaggerates the difference. Turn that dial too high and you get oversaturated images with a suspicious number of top hats.

## Latent diffusion: why it runs on a normal GPU

Denoising a full-resolution image a few dozen times is expensive. Latent diffusion sidesteps this by first compressing the image with an autoencoder into a much smaller representation (say 64 by 64 instead of 512 by 512), running the entire diffusion process in that compressed space, and decoding back to pixels only at the end.

The model only ever touches a compressed sketch, which is dozens of times cheaper. It is the reason the popular open models run on a gaming card rather than a data centre.

## Why hands, text and fingerprints give generated images away

Diffusion models learn statistics, not anatomy. A hand can have fingers spread, curled, hidden or overlapping, so the training data averages out to "a fleshy blob with some finger-shaped edges". The model reproduces the texture perfectly and the count approximately. Six fingers is not a bug; it is the mean.

Text is worse: letters are small, high-frequency detail, exactly what latent compression discards before diffusion starts. The model learns "text-shaped squiggles in the right place" and dutifully produces them. Newer models do better, but the failure mode is inherent: the model has no idea what a hand or a word is for.

The same statistical habit is why generated images leave detectable traces:

- The autoencoder's decoder stamps its own regular texture onto every image it produces.
- The denoising steps favour smooth, "average" pixel relationships that a real camera sensor, with its own noise and lens quirks, never produces.
- Upscalers add another layer of pattern on top.

None of this is visible to a person, but most of it is visible to a classifier trained to look, because the generator optimises to fool humans, not to be indistinguishable from a camera. I covered the practical side in [how to spot AI-generated images](/blog/how-to-spot-ai-generated-images/), and it sits close to [my research area](/#research).

## What to remember

- Training adds noise to real images step by step; the network learns only to predict that noise.
- Generation runs the process backwards, from pure static to something plausible.
- A text encoder turns the prompt into a vector that steers every denoising step.
- Latent diffusion runs in a compressed space, which is why it is fast enough to be a product.
- Hands, text and fingerprints all come from the same fact: the model learns statistics, not the world.

If you ever feel bad about your own work, remember that a billion-dollar model starts every masterpiece as static and just keeps removing the wrong bits.
