# BrowserStack meetup draft — 2026-11-25

**Status:** DRAFT. Not sent. Do not submit this file, a bio, or a headshot without an explicit human decision.  
**Talk title:** Who Tests the AI That Tests Your Software?  
**Event:** BrowserStack Online Meetup, 2026-11-25.  
**Audience:** Manual QA and SDET practitioners with about 2–5 years of experience.  
**Planned lengths:** 12-minute demo inside about 35 minutes of content. Neither length has been rehearsed. This draft does not claim S-008 is complete.

## Abstract

A checkout screen can say the order succeeded while the order was never stored. A language model can explain that result in confident language and still be wrong. This talk walks through a small local store, a user-interface check that only sees the screen, a separate read of the stored order, and a release decision that stays allow, block, or hold. Hold is for the case where that stored-order read cannot be completed. It is a different outcome from a read that completes and shows the order is missing. The session is aimed at people who test software and who are starting to test systems that include a model. It does not present measured model scores. Those scores do not exist yet.

## Agenda (planned, not rehearsed)

| Minutes | Segment | What the speaker can say now |
|---|---|---|
| 0–5 | The problem | A passing screen and a fluent explanation are both weak evidence. |
| 5–15 | False confidence | Describe the intended contrast: the screen accepts the checkout, and an independent read does not find the order. The live demo script is a later task. |
| 15–25 | Separate roles | One read-only investigation, one independent check of the stored order, and one deterministic allow / block / hold decision. The model does not approve the release. |
| 25–32 | What will count | Labels and metrics will come from runs that have actually happened. This draft does not invent them. |
| 32–35 | Close | Point to the repo and leave time for questions. No claim that a recording already exists. |

## Bio checklist

Fill these in before anyone sends the proposal. Do not replace the placeholders with guessed facts.

- Name: `[SPEAKER_NAME]`
- Role: `[ROLE]`
- Relevant experience, in the speaker's own words: `[EXPERIENCE]`
- One sentence on why this topic: `[WHY_THIS_TALK]`
- Contact the meetup form should use: `[CONTACT]`

Suggested shape, still unsent:

> `[SPEAKER_NAME]` is a `[ROLE]`. `[EXPERIENCE]` This talk looks at how to test a checkout when the screen and the stored order disagree, and how to keep a model's explanation separate from the release decision.

## Headshot

Do not add a personal photograph to this public repository. The speaker keeps the image outside the repo and attaches it only in the meetup form, after reviewing this draft. This task does not include an image file.

## Sending checklist

- [ ] A human replaced every placeholder with facts they are willing to publish.
- [ ] The headshot is chosen and stored outside this repo.
- [ ] The abstract still avoids measured scores, customer names, and claims that the demo recording exists.
- [ ] A human explicitly decides to send the proposal.
