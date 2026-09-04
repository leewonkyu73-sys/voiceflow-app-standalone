# Chat Layout v278 acceptance

- Desktop: header -> horizontal app menu -> compact language bar -> large scrollable chat -> one composer.
- Desktop chat stream consumes remaining viewport height.
- Video is picture-in-picture on desktop and compact inline on fold/mobile.
- Fold (601-900px): language controls remain two columns, chat occupies remaining height, test actions hidden.
- Phone (<=600px): compact header, two language selectors, large chat stream, sticky composer.
- No functional API/provider changes in this patch.
