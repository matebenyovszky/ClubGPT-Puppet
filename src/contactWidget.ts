// Simple contact/waitlist widget using Web3Forms
export function initContactWidget(web3FormsKey: string) {
    if (!web3FormsKey) {
        console.warn('[contactWidget] No Web3Forms key provided');
        return;
    }

    // Create floating contact button
    const btn = document.createElement('button');
    btn.id = 'contact-widget-btn';
    btn.textContent = '✉️ Contact / Waitlist';
    btn.style.position = 'fixed';
    // Center vertically and horizontally
    btn.style.top = '50%';
    btn.style.left = '50%';
    btn.style.transform = 'translate(-50%, -50%)';
    btn.style.zIndex = '10002';
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

    btn.addEventListener('mouseenter', () => {
        btn.style.transform = 'translateX(-50%) translateY(-2px)';
        btn.style.boxShadow = '0 6px 20px rgba(102, 126, 234, 0.6)';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translateX(-50%)';
        btn.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
    });

    document.body.appendChild(btn);

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
        close.addEventListener('click', () => { overlay.style.display = 'none'; btn.style.display = ''; });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { overlay.style.display = 'none'; btn.style.display = ''; }
        });
        try {
            window.addEventListener('keydown', (e: any) => {
                if (e.key === 'Escape' && overlay.style.display !== 'none') { overlay.style.display = 'none'; btn.style.display = ''; }
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
        btn.style.display = 'none';
    });
}

