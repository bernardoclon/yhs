Hooks.on("ready", () => {
    // Configurar un observador para detectar cuando aparece el pause screen
    const observer = new MutationObserver((mutations) => {
        const pauseScreen = document.getElementById("pause");
        if (pauseScreen) {
            const img = pauseScreen.querySelector("img");
            if (img && !img.classList.contains('customized')) {
                img.src = "systems/yokai-hunters-society/art/logo.png";
                img.classList.add('customized'); // Marcar como modificado
                
                // Opcional: Cambiar el texto a un texto localizado
                const caption = pauseScreen.querySelector("figcaption");
                if (caption) caption.textContent = game.i18n.localize("YOKAIHUNTERSSOCIETY.GamePaused");
            }
        }
    });

    // Observar cambios en el body
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});
