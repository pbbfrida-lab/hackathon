(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const t = (key, vars) => window.I18N.t(key, vars);
  const conversations = new Map();
  let selectedStaff = null;
  let recognition = null;
  let busy = false;

  function setStatus(message) {
    $('#agentPanelStatus').textContent = message || '';
  }

  function setVoiceLabel(listening) {
    $('#agentVoiceLabel').textContent = t(listening ? 'dashboard.stopVoice' : 'dashboard.voice');
    $('#agentVoice').setAttribute('aria-pressed', String(listening));
  }

  function currentConversation() {
    if (!selectedStaff) return [];
    if (!conversations.has(selectedStaff.id)) {
      conversations.set(selectedStaff.id, [{
        role: 'assistant',
        label: selectedStaff.name,
        text: t('dashboard.agentGreeting', { name: selectedStaff.name }),
      }]);
    }
    return conversations.get(selectedStaff.id);
  }

  function renderConversation() {
    const log = $('#agentConversation');
    log.textContent = '';
    currentConversation().forEach((message) => {
      const row = document.createElement('article');
      row.className = `agent-message ${message.role}`;
      const label = document.createElement('b');
      label.textContent = message.role === 'owner' ? t('dashboard.you') : message.label || selectedStaff.name;
      const text = document.createElement('p');
      text.textContent = message.text;
      row.append(label, text);
      if (message.imageUrl) {
        const image = document.createElement('img');
        image.src = message.imageUrl;
        image.alt = t('dashboard.promoAlt');
        row.append(image);
      }
      log.append(row);
    });
    log.scrollTop = log.scrollHeight;
  }

  function stopRecognition() {
    if (!recognition) return;
    const active = recognition;
    recognition = null;
    active.abort();
    setVoiceLabel(false);
  }

  function openForStaff(staff, attempts = 0) {
    const panel = $('#agentPanel');
    if (!staff) {
      if (panel) panel.hidden = true;
      selectedStaff = null;
      stopRecognition();
      return;
    }
    if (!panel || !$('#agentName') || !$('#agentRole') || !$('#agentTask')) {
      if (attempts < 20) window.setTimeout(() => openForStaff(staff, attempts + 1), 50);
      return;
    }
    if (selectedStaff && selectedStaff.id !== staff.id) stopRecognition();
    selectedStaff = staff;
    $('#agentName').textContent = staff.name || staff.id;
    $('#agentRole').textContent = staff.role || '';
    $('#agentTask').textContent = staff.task || '';
    panel.hidden = false;
    $('#agentVoice').disabled = !window.Voice || !window.Voice.supported;
    if ($('#agentVoice').disabled) setStatus(t('dashboard.voiceUnsupported'));
    else setStatus('');
    renderConversation();
  }

  window.OfficeInteraction = {
    open: (staff) => openForStaff(staff),
    close: () => openForStaff(null),
  };
  window.addEventListener('office:agent-selected', (event) => openForStaff(event.detail));

  async function sendMessage(rawMessage, viaVoice = false) {
    const message = String(rawMessage || '').trim();
    if (!message || !selectedStaff || busy) return;

    const staff = selectedStaff;
    const agentKey = staff.id === 'cs' ? 'customer_service' : staff.id;
    const messages = currentConversation();
    const pending = { role: 'assistant', label: staff.name, text: t('dashboard.working') };
    messages.push({ role: 'owner', text: message }, pending);
    renderConversation();
    setStatus(t('dashboard.working'));
    busy = true;
    $('#agentSend').disabled = true;
    $('#agentMessage').disabled = true;
    $('#agentVoice').disabled = true;

    try {
      const result = await window.api(viaVoice ? '/api/ai/voice' : '/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify(viaVoice
          ? { transcript: message, sessionId: `dashboard-owner-${staff.id}`, agentKey }
          : { message, sessionId: `dashboard-owner-${staff.id}`, agentKey }),
      });
      Object.assign(pending, {
        label: result.staff || staff.name,
        text: result.reply,
        imageUrl: result.imageUrl,
      });
      if (viaVoice) window.Voice.speak(result.reply);
      setStatus('');
    } catch (error) {
      pending.role = 'error';
      pending.text = error.message || t('dashboard.agentReplyFailed');
      setStatus(t('dashboard.agentReplyFailed'));
    } finally {
      busy = false;
      $('#agentSend').disabled = false;
      $('#agentMessage').disabled = false;
      $('#agentVoice').disabled = !window.Voice || !window.Voice.supported;
      renderConversation();
    }
  }

  let initializationAttempts = 0;
  function initializeInteractions() {
    if (!$('#agentPanel') || !$('#agentClose') || !$('#staff-list')) {
      if (initializationAttempts < 20) {
        initializationAttempts += 1;
        window.setTimeout(initializeInteractions, 50);
      }
      return;
    }

    $('#agentClose').addEventListener('click', () => {
      stopRecognition();
      if (window.OfficeScene) window.OfficeScene.clearSelection();
      $('#agentPanel').hidden = true;
      selectedStaff = null;
    });

    $('#agentMessageForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const field = $('#agentMessage');
      const message = field.value.trim();
      if (!message) return;
      field.value = '';
      sendMessage(message);
    });

    $('#agentVoice').addEventListener('click', () => {
      if (recognition) {
        stopRecognition();
        setStatus('');
        return;
      }
      if (!window.Voice || !window.Voice.supported) {
        setStatus(t('dashboard.voiceUnsupported'));
        return;
      }
      setStatus(t('dashboard.voiceListening'));
      recognition = window.Voice.listen((transcript) => {
        recognition = null;
        setVoiceLabel(false);
        sendMessage(transcript, true);
      }, (state) => {
        if (state === 'listening') {
          setVoiceLabel(true);
          setStatus(t('dashboard.voiceListening'));
        } else if (state === 'idle') {
          recognition = null;
          setVoiceLabel(false);
          if ($('#agentPanelStatus').textContent === t('dashboard.voiceListening')) setStatus('');
        } else if (state === 'unsupported' || state.startsWith('error:')) {
          recognition = null;
          setVoiceLabel(false);
          setStatus(state === 'unsupported' ? t('dashboard.voiceUnsupported') : t('dashboard.voiceError'));
        }
      });
    });

    $('#staff-list').addEventListener('click', (event) => {
      const button = event.target.closest('[data-agent-id]');
      if (button && window.OfficeScene) window.OfficeScene.select(button.dataset.agentId);
    });
    window.I18N.onLangChange(() => {
      if (selectedStaff) {
        $('#agentPanelStatus').textContent = '';
        renderConversation();
      }
    });
  }

  initializeInteractions();
})();
