// Simple contact/waitlist widget using Web3Forms
export function initContactWidget(web3FormsKey: string) {
    console.log('[contactWidget] initContactWidget called with key:', web3FormsKey ? '***' + web3FormsKey.slice(-4) : 'EMPTY');
    
    if (!web3FormsKey) {
        console.warn('[contactWidget] No Web3Forms key provided');
        return;
    }
    
    console.log('[contactWidget] Creating contact widget UI...');

    // Create container for buttons to keep them centered together
    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'contact-buttons-container';
    buttonContainer.style.position = 'fixed';
    buttonContainer.style.top = '50%';
    buttonContainer.style.left = '50%';
    buttonContainer.style.transform = 'translate(-50%, -50%)';
    buttonContainer.style.zIndex = '10002';
    buttonContainer.style.display = 'flex';
    buttonContainer.style.flexDirection = 'column';
    buttonContainer.style.gap = '16px';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.pointerEvents = 'none'; // Allow clicks to pass through to buttons

    // Create headline text
    const headline = document.createElement('div');
    headline.style.color = '#fff';
    headline.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
    headline.style.fontSize = '20px';
    headline.style.fontWeight = '600';
    headline.style.textAlign = 'center';
    headline.style.maxWidth = '600px';
    headline.style.lineHeight = '1.5';
    headline.style.marginBottom = '8px';
    headline.style.textShadow = '0 2px 10px rgba(0, 0, 0, 0.5)';
    headline.innerHTML = 'Do you want an online representative,<br>a charming character for your AI agent<br>with 3D interactive companion?';
    buttonContainer.appendChild(headline);

    // Create "Watch in action" button
    const watchBtn = document.createElement('button');
    watchBtn.id = 'watch-action-btn';
    watchBtn.textContent = '🎬 Watch in action';
    watchBtn.style.padding = '12px 24px';
    watchBtn.style.background = 'linear-gradient(135deg, #cc3333 0%, #aa2222 100%)';
    watchBtn.style.color = '#fff';
    watchBtn.style.border = 'none';
    watchBtn.style.borderRadius = '25px';
    watchBtn.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
    watchBtn.style.fontSize = '14px';
    watchBtn.style.fontWeight = '600';
    watchBtn.style.cursor = 'pointer';
    watchBtn.style.boxShadow = '0 4px 15px rgba(204, 51, 51, 0.4)';
    watchBtn.style.transition = 'all 0.3s ease';
    watchBtn.style.pointerEvents = 'auto';

    watchBtn.addEventListener('mouseenter', () => {
        watchBtn.style.transform = 'translateY(-2px)';
        watchBtn.style.boxShadow = '0 6px 20px rgba(204, 51, 51, 0.6)';
    });

    watchBtn.addEventListener('mouseleave', () => {
        watchBtn.style.transform = 'translateY(0)';
        watchBtn.style.boxShadow = '0 4px 15px rgba(204, 51, 51, 0.4)';
    });

    // Open video in new window/tab
    watchBtn.addEventListener('click', () => {
        // Replace with your actual video URL
        const videoUrl = 'https://www.youtube.com/playlist?list=PLAKNcEe8hRMllqKaLAeT6KAO-U4WntnCR';
        window.open(videoUrl, '_blank', 'noopener,noreferrer');
    });

    // Create floating contact button
    const btn = document.createElement('button');
    btn.id = 'contact-widget-btn';
    btn.textContent = '✉️ Contact / Waitlist';
    btn.style.padding = '12px 24px';
    btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '25px';
    btn.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
    btn.style.fontSize = '14px';
    btn.style.fontWeight = '600';
    btn.style.cursor = 'pointer';
    btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    btn.style.transition = 'all 0.3s ease';
    btn.style.pointerEvents = 'auto';

    // Add both buttons to container
    buttonContainer.appendChild(watchBtn);
    buttonContainer.appendChild(btn);
    document.body.appendChild(buttonContainer);
    
    console.log('[contactWidget] Buttons added to DOM:', {
        containerId: buttonContainer.id,
        watchBtnId: watchBtn.id,
        btnId: btn.id,
        containerVisible: buttonContainer.style.display !== 'none'
    });

    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    });

    // Create modal
    const createModal = () => {
        const overlay = document.createElement('div');
        overlay.id = 'contact-widget-modal';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.background = 'rgba(0, 0, 0, 0.7)';
        overlay.style.zIndex = '10003';
        overlay.style.display = 'none';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.pointerEvents = 'auto';

        const modal = document.createElement('div');
        modal.style.background = '#1a1a2e';
        modal.style.borderRadius = '16px';
        modal.style.padding = '24px';
        modal.style.boxSizing = 'border-box';
        // Mobile-friendly width
        modal.style.width = 'min(92vw, 440px)';
        modal.style.maxWidth = '440px';
        modal.style.maxHeight = '90vh';
        modal.style.overflowY = 'auto';
        modal.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.5)';
        modal.style.position = 'relative';

        const close = document.createElement('button');
        close.textContent = '×';
        close.style.position = 'absolute';
        close.style.top = '12px';
        close.style.right = '12px';
        close.style.background = 'transparent';
        close.style.border = 'none';
        close.style.color = '#fff';
        close.style.fontSize = '32px';
        close.style.cursor = 'pointer';
        close.style.opacity = '0.6';
        close.style.transition = 'opacity 0.2s';
        close.addEventListener('mouseenter', () => close.style.opacity = '1');
        close.addEventListener('mouseleave', () => close.style.opacity = '0.6');

        const title = document.createElement('h2');
        title.textContent = 'Join the Waitlist';
        title.style.color = '#fff';
        title.style.marginTop = '0';
        title.style.marginBottom = '8px';
        title.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
        title.style.fontSize = '20px';
        title.style.fontWeight = '700';

        const subtitle = document.createElement('p');
        subtitle.textContent = 'Get early access and updates';
        subtitle.style.color = '#aaa';
        subtitle.style.marginTop = '0';
        subtitle.style.marginBottom = '24px';
        subtitle.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
        subtitle.style.fontSize = '13px';

        const form = document.createElement('form');
        form.action = 'https://api.web3forms.com/submit';
        form.method = 'POST';
        form.noValidate = true;

        const accessKeyInput = document.createElement('input');
        accessKeyInput.type = 'hidden';
        accessKeyInput.name = 'access_key';
        accessKeyInput.value = web3FormsKey;

        // Metadata fields
        const subjectInput = document.createElement('input');
        subjectInput.type = 'hidden';
        subjectInput.name = 'subject';
        subjectInput.value = 'Puppet Waitlist signup';

        const sourceInput = document.createElement('input');
        sourceInput.type = 'hidden';
        sourceInput.name = 'source';
        try { sourceInput.value = `aixrep-website (${location.hostname})`; } catch { sourceInput.value = 'aixrep-website'; }

        const pageUrlInput = document.createElement('input');
        pageUrlInput.type = 'hidden';
        pageUrlInput.name = 'page_url';
        try { pageUrlInput.value = String(location.href); } catch { pageUrlInput.value = ''; }

        const userAgentInput = document.createElement('input');
        userAgentInput.type = 'hidden';
        userAgentInput.name = 'user_agent';
        try { userAgentInput.value = String(navigator.userAgent || ''); } catch { userAgentInput.value = ''; }

        const emailInput = document.createElement('input');
        emailInput.type = 'email';
        emailInput.name = 'email';
        emailInput.placeholder = 'Enter your email';
        emailInput.required = true;
        emailInput.style.width = '90%';
        emailInput.style.padding = '12px 14px';
        emailInput.style.marginBottom = '16px';
        emailInput.style.border = '1px solid #333';
        emailInput.style.borderRadius = '8px';
        emailInput.style.background = '#16213e';
        emailInput.style.color = '#fff';
        emailInput.style.fontSize = '14px';
        emailInput.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
        emailInput.style.outline = 'none';
        emailInput.style.transition = 'border-color 0.2s';
        emailInput.addEventListener('focus', () => emailInput.style.borderColor = '#667eea');
        emailInput.addEventListener('blur', () => emailInput.style.borderColor = '#333');

        // Optional message field
        const messageInput = document.createElement('textarea');
        messageInput.name = 'message';
        messageInput.placeholder = 'Add a short message (optional)';
        messageInput.style.width = '90%';
        messageInput.style.minHeight = '84px';
        messageInput.style.padding = '12px 14px';
        messageInput.style.marginBottom = '16px';
        messageInput.style.border = '1px solid #333';
        messageInput.style.borderRadius = '8px';
        messageInput.style.background = '#16213e';
        messageInput.style.color = '#fff';
        messageInput.style.fontSize = '14px';
        messageInput.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
        messageInput.style.outline = 'none';
        messageInput.style.resize = 'vertical';

        const submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.textContent = 'Join Waitlist';
        submitBtn.style.width = '100%';
        submitBtn.style.padding = '12px 14px';
        submitBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        submitBtn.style.color = '#fff';
        submitBtn.style.border = 'none';
        submitBtn.style.borderRadius = '8px';
        submitBtn.style.fontSize = '16px';
        submitBtn.style.fontWeight = '600';
        submitBtn.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif';
        submitBtn.style.cursor = 'pointer';
        submitBtn.style.transition = 'transform 0.2s, box-shadow 0.2s';
        submitBtn.addEventListener('mouseenter', () => {
            submitBtn.style.transform = 'translateY(-2px)';
            submitBtn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
        });
        submitBtn.addEventListener('mouseleave', () => {
            submitBtn.style.transform = 'translateY(0)';
            submitBtn.style.boxShadow = 'none';
        });

        const statusMsg = document.createElement('div');
        statusMsg.style.marginTop = '16px';
        statusMsg.style.color = '#aaa';
        statusMsg.style.fontSize = '14px';
        statusMsg.style.textAlign = 'center';
        statusMsg.style.display = 'none';

        form.appendChild(accessKeyInput);
        form.appendChild(subjectInput);
        form.appendChild(sourceInput);
        form.appendChild(pageUrlInput);
        form.appendChild(userAgentInput);
        form.appendChild(emailInput);
        form.appendChild(messageInput);
        form.appendChild(submitBtn);
        form.appendChild(statusMsg);

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
            statusMsg.style.display = 'block';
            statusMsg.style.color = '#aaa';
            statusMsg.textContent = 'Submitting...';

            try {
                const formData = new FormData(form);
                const response = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    statusMsg.style.color = '#4ade80';
                    statusMsg.textContent = '✓ Success! Check your email.';
                    emailInput.value = '';
                    setTimeout(() => {
                        overlay.style.display = 'none';
                        buttonContainer.style.display = 'flex';
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Join Waitlist';
                        statusMsg.style.display = 'none';
                    }, 2000);
                } else {
                    throw new Error(result.message || 'Submission failed');
                }
            } catch (err: any) {
                statusMsg.style.color = '#f87171';
                statusMsg.textContent = `Error: ${err.message || 'Please try again'}`;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Join Waitlist';
            }
        });

        modal.appendChild(close);
        modal.appendChild(title);
        modal.appendChild(subtitle);
        modal.appendChild(form);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Close handlers
        close.addEventListener('click', () => { overlay.style.display = 'none'; buttonContainer.style.display = 'flex'; });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { overlay.style.display = 'none'; buttonContainer.style.display = 'flex'; }
        });
        try {
            window.addEventListener('keydown', (e: any) => {
                if (e.key === 'Escape' && overlay.style.display !== 'none') { overlay.style.display = 'none'; buttonContainer.style.display = 'flex'; }
            });
        } catch {}

        return overlay;
    };

    let modal: HTMLDivElement | null = null;

    btn.addEventListener('click', () => {
        if (!modal) {
            modal = createModal();
        }
        modal.style.display = 'flex';
        buttonContainer.style.display = 'none';
    });
}

