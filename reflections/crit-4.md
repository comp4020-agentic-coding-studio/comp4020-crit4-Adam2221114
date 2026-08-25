# Reflections

## What was the breakthrough that moved the work forward?

The breakthrough was realising that the instrument should not behave like a collection of separate sound buttons. It needed to feel like one continuous sound system that the player could keep shaping.

This changed how I thought about the Web Audio structure. Instead of creating a new sound for every interaction, I kept one persistent `AudioContext` and audio graph, then let the player change that sound through pitch, FILTER, level, pads and the crossfader. This made the controls feel connected rather than independent. It also influenced later decisions, such as keeping the player’s settings when the instrument is paused and resumed.

Once I made this decision, the prototype started to feel more like an actual instrument. There is no single correct way to play it. Different combinations of controls create different results, so two people can use the same page and produce different sounds.

## What did this work change about who I want to be as a software developer?

This work made me want to think more about the behaviour and experience of a system before adding more features. A technically working interface is not automatically a good interaction.

I want to become a developer who builds a clear underlying idea first, then uses testing and real interaction to refine it. For me, good software should not only work correctly; its structure should also support the experience the user is supposed to have.
