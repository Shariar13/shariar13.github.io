---
title: "How to Spot AI-Generated Images: A Forensics Field Guide"
date: 2026-08-24
description: "How AI-generated image detection actually works: camera fingerprints, frequency artefacts, CLIP embeddings, and why your eyes are the least reliable tool."
tags: [Deepfakes, Digital Forensics, Computer Vision, AI]
---

A colleague once sent me a photo of a "rare Portsmouth sunset" and asked whether it was real. I zoomed in on the hands of a person in the corner, counted six fingers, and felt very clever for about four seconds. Then I noticed the sun was setting in the east.

That is the state of the art for human deepfake detection: counting fingers and hoping the model made a mistake that a toddler would spot. Modern generators do not make those mistakes any more. The hands are fine. The teeth are fine. The sunset is geographically impossible, but so are most stock photos.

So this post is about how AI-generated image detection actually works when you stop trusting your eyes, which is the problem I work on in my research. None of it is magic. Most of it is statistics that a camera leaves behind and a diffusion model forgets to fake.

## Why "it looks fake" is not a detection method

Human perception is tuned for faces, symmetry and lighting. It is not tuned for the noise floor of a CMOS sensor. When a generator produces a face, it optimises for exactly the things you check, because those are the things in its training loss. The stuff you cannot see is where the evidence lives.

There is also a base-rate problem. If you look at a thousand images and confidently declare a hundred of them fake based on vibes, you will be wrong often enough that nobody should let you near a court case. Forensics needs measurements, thresholds and error rates, not a hunch and a magnifying glass.

## Camera fingerprints: PRNU noise

Every camera sensor is slightly defective. Each photosite responds to light a tiny bit differently from its neighbours because of manufacturing variation. That pattern of tiny per-pixel gain differences is called **Photo-Response Non-Uniformity (PRNU)**, and it is effectively a fingerprint for the sensor.

The forensic trick works like this:

1. Take several images from the same camera.
2. Denoise each one and subtract the denoised version from the original. What remains is mostly noise, including the PRNU pattern.
3. Average the residuals. Random noise cancels; the sensor pattern survives.
4. For a new image, extract its residual and correlate it with the reference fingerprint.

A real photo from that camera correlates. A photo from a different camera does not. An AI-generated image correlates with nothing, because there was no sensor. The generator produces plausible pixels, not plausible sensor physics.

In practice this is noisier than it sounds. JPEG compression, resizing and social-media re-encoding all chew through the residual. But the principle is the important part: **real images carry evidence of a physical capture process, and generators do not reproduce it unless someone explicitly trains them to**.

## Frequency-domain artefacts: the generator's accent

Generators, especially anything with upsampling layers, leave periodic patterns in the image that you cannot see in pixel space but that light up in the frequency domain. If you take a 2D Fourier transform of a generated image, you often see regular peaks that real photographs do not have. Think of it as an accent. The model speaks fluent "image", but it learned it from a fixed set of convolution kernels and the rhythm shows.

Here is the two-line version, which is genuinely all you need to look at the spectrum yourself:

```python
import numpy as np
from PIL import Image

img = np.asarray(Image.open("suspect.png").convert("L"), dtype=np.float32)
spectrum = np.log1p(np.abs(np.fft.fftshift(np.fft.fft2(img))))
Image.fromarray((255 * spectrum / spectrum.max()).astype("uint8")).save("spectrum.png")
```

Run that on a phone photo and on a generated image. The phone photo's spectrum decays smoothly from the centre. The generated one often has a grid of bright spots or a suspiciously clean high-frequency region, because the generator never bothered to produce realistic fine-grained noise. Newer diffusion models are better at hiding this, which is why nobody serious relies on a single artefact.

## Semantic embeddings: asking CLIP what it thinks

The handcrafted features above are precise but brittle. A resize can wreck them. The other approach is to use a large vision model, such as CLIP, as a feature extractor. You run the image through the encoder, take the embedding vector, and train a small classifier on top to separate "real" from "generated".

Why does this work at all? Because generated images cluster in embedding space in ways real ones do not. They are, on average, too clean, too centred, too well lit, too consistent in style. The embedding captures "this looks like the kind of thing a generator makes" even when no single pixel gives it away.

The zero-shot part is the surprising bit. A CLIP encoder trained on ordinary image-text pairs, never shown a single deepfake, still produces features that separate real and synthetic images reasonably well. It generalises to generators it has never seen, which is precisely what pixel-level artefact detectors fail to do.

## Why hybrid detectors win

Each signal has a failure mode:

| Signal | Strength | Breaks when |
|---|---|---|
| PRNU / sensor noise | Physically grounded, hard to fake | Heavy compression, resizing, screenshots |
| Frequency artefacts | Cheap, fast, generator-specific | New architectures, post-processing filters |
| CLIP-style embeddings | Generalises across generators | Adversarial edits, unusual real photos |
| Metadata (EXIF) | Trivial to check | Trivial to strip or forge |

Notice that "metadata" is on that list purely so I can tell you to stop relying on it. EXIF data is a text field. Anyone can write "Canon EOS R5" into it. Absence of metadata proves nothing either, because every messaging app strips it.

The sensible design is to combine several weak, independent signals into one classifier and report a calibrated probability, not a verdict. That is the design philosophy I favour: forensic features plus semantic embeddings, feeding a lightweight model that can explain which signal fired. A detector that says "fake, 97%, because of frequency peaks and no sensor pattern" is useful evidence. A detector that says "fake" is an opinion with a GPU.

## What a good detector reports

If you are evaluating a deepfake detection tool, or building one, these are the questions that matter:

- **False positive rate on real images**, measured on photos that went through social media, not pristine camera output.
- **Generalisation** to generators released after the training data was collected.
- **Robustness** to resizing, re-compression and cropping, which is what every image on the internet has been through.
- **Explainability**: which features drove the decision. "The model said so" does not survive cross-examination.
- **Calibration**: when it says 80%, is it right about 80% of the time?

A detector with 99.9% accuracy on its own test set and no answer to the above is a demo, not a tool.

## What to remember

- Your eyes are the weakest detector available. Generators optimise for exactly what you look at.
- Real photos carry physical traces, such as PRNU sensor noise, that generators do not reproduce.
- Generators leave frequency-domain artefacts, but each new architecture changes the pattern.
- Large vision-model embeddings generalise across generators better than handcrafted features.
- Robust detection combines several independent signals and reports calibrated probabilities with reasons.
- Metadata proves nothing in either direction.

## Further reading

- [NIST Media Forensics Challenge](https://www.nist.gov/itl/iad/mig/media-forensics-challenge) for how evaluation is done properly.
- [OpenAI CLIP paper](https://arxiv.org/abs/2103.00020) for the model behind the embedding approach. Or count fingers. It is character-building.
