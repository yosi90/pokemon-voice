import { useCallback, useEffect, useRef, useState } from 'react';
import { ACV } from '../../scripts/achievements-logic.js';
import { esAliases, esToEnCorrections, normalize } from '../../scripts/utils.js';

function getSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function hasSpeechRecognitionSupport() {
  return typeof window !== 'undefined' && !!getSpeechRecognitionCtor();
}

function speechErrorMessage(error) {
  return {
    'not-allowed': 'Permiso de micrófono denegado.',
    'service-not-allowed': 'El navegador bloqueó el servicio de voz.',
    'no-speech': 'No detecté voz. Reintentando...',
    network: 'Error de red en el reconocimiento.',
    'audio-capture': 'No encuentro un micrófono disponible.',
    'language-not-supported': 'El navegador no soporta reconocimiento en español.',
    'language-unavailable': 'El idioma español no está disponible.',
  }[error] || `Error de micrófono: ${error || 'desconocido'}`;
}

function isFatalSpeechError(error) {
  return ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported', 'language-unavailable'].includes(error);
}

async function ensureMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) return { ok: true };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return { ok: true };
  } catch (error) {
    const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError';
    const missing = error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError';
    return {
      ok: false,
      message: missing
        ? 'No encuentro un micrófono disponible.'
        : denied
          ? 'Permiso de micrófono denegado en el navegador.'
          : `No se pudo acceder al micrófono: ${error?.name || 'error desconocido'}`,
    };
  }
}

export function useSpeechRecognition({ allPokemon, guess, tryGuessTranscript, showToast }) {
  const [listening, setListening] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState(null);
  const [speechSupported] = useState(hasSpeechRecognitionSupport);

  const recognitionRef = useRef(null);
  const speechQueueRef = useRef(Promise.resolve());
  const speechRestartTimerRef = useRef(null);
  const speechRestartDelayRef = useRef(350);
  const speechFatalRef = useRef(false);
  const listeningRef = useRef(false);

  useEffect(() => {
    listeningRef.current = listening;
  }, [listening]);

  const applySpeechBias = useCallback(rec => {
    if (!('phrases' in rec)) return;
    try {
      const names = allPokemon.flatMap(p => [p.name, p.name.replace(/-/g, ' ')]);
      const aliases = [...esAliases.keys(), ...esAliases.values(), ...esToEnCorrections.keys(), ...esToEnCorrections.values()];
      rec.phrases = [...new Set([...names, ...aliases].map(normalize).filter(Boolean))].map(phrase => ({ phrase, boost: 8 }));
    } catch (error) {
      console.info('Sesgo contextual de voz no disponible:', error);
    }
  }, [allPokemon]);

  const configureLocalSpeech = async (rec, SR) => {
    if (!('processLocally' in rec) || typeof SR?.available !== 'function') return;
    try {
      const status = await SR.available({ langs: ['es-ES'], processLocally: true });
      if (status === 'available') {
        rec.processLocally = true;
        setVoiceStatus({ message: 'Voz local lista', kind: 'ok' });
      }
    } catch {}
  };

  const handleSpeechBatches = useCallback(async batches => {
    for (const alternatives of batches) {
      if (!listeningRef.current) return;
      const candidates = alternatives.map(a => (a.transcript || '').trim()).filter(Boolean);
      if (!candidates.length) continue;
      setVoiceStatus({ message: `Oído: ${candidates[0]}`, kind: 'info' });
      const selected = candidates.find(transcript => tryGuessTranscript(transcript, { fromSpeech: true }).matched);
      if (selected) {
        setVoiceStatus({ message: `Usando: ${selected}`, kind: 'ok' });
        await guess(selected, { fromSpeech: true });
        continue;
      }
      const fused = candidates.join(' ');
      if (tryGuessTranscript(fused, { fromSpeech: true }).matched) {
        setVoiceStatus({ message: `Usando: ${fused}`, kind: 'ok' });
        await guess(fused, { fromSpeech: true });
        continue;
      }
      setVoiceStatus({ message: `No reconocido: ${candidates[0]}`, kind: 'bad' });
      showToast(`No encontré "${candidates[0]}"`, 'bad');
      try {
        await ACV.registerFail();
      } catch {}
    }
  }, [guess, showToast, tryGuessTranscript]);

  const initSpeech = useCallback(() => {
    const SR = getSpeechRecognitionCtor();
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 8;
    applySpeechBias(rec);
    rec.onresult = event => {
      const batches = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        if (event.results[i].isFinal) {
          batches.push([...event.results[i]].map(a => ({ transcript: a.transcript, confidence: a.confidence })));
        }
      }
      if (!batches.length) return;
      speechQueueRef.current = speechQueueRef.current.then(() => handleSpeechBatches(batches));
    };
    rec.onerror = event => {
      const fatal = isFatalSpeechError(event.error);
      speechFatalRef.current = fatal;
      const message = speechErrorMessage(event.error);
      setVoiceStatus({ message, kind: 'bad' });
      showToast(message, 'bad');
      if (fatal) {
        listeningRef.current = false;
        setListening(false);
      }
    };
    rec.onend = () => {
      if (!listeningRef.current || speechFatalRef.current) return;
      window.clearTimeout(speechRestartTimerRef.current);
      setVoiceStatus({ message: 'Reiniciando escucha...', kind: 'info' });
      speechRestartTimerRef.current = window.setTimeout(() => {
        if (!listeningRef.current || speechFatalRef.current) return;
        try {
          rec.start();
          speechRestartDelayRef.current = 350;
          setVoiceStatus({ message: 'Escuchando...', kind: 'ok' });
        } catch {
          speechRestartDelayRef.current = Math.min(speechRestartDelayRef.current + 250, 2000);
        }
      }, speechRestartDelayRef.current);
    };
    return rec;
  }, [applySpeechBias, handleSpeechBatches, showToast]);

  const stopListening = useCallback(() => {
    listeningRef.current = false;
    window.clearTimeout(speechRestartTimerRef.current);
    try {
      recognitionRef.current?.stop();
    } catch {}
    setListening(false);
    setVoiceStatus(null);
  }, []);

  const toggleListening = useCallback(async () => {
    if (listeningRef.current) {
      stopListening();
      return;
    }
    if (!recognitionRef.current) {
      recognitionRef.current = initSpeech();
      if (recognitionRef.current) configureLocalSpeech(recognitionRef.current, getSpeechRecognitionCtor());
    }
    if (!recognitionRef.current) {
      showToast('Tu navegador no soporta reconocimiento de voz.', 'bad');
      setVoiceStatus({ message: 'Voz no soportada', kind: 'bad' });
      return;
    }
    const mic = await ensureMicrophoneAccess();
    if (!mic.ok) {
      speechFatalRef.current = true;
      setListening(false);
      setVoiceStatus({ message: mic.message, kind: 'bad' });
      showToast(mic.message, 'bad');
      return;
    }
    try {
      speechFatalRef.current = false;
      speechRestartDelayRef.current = 350;
      listeningRef.current = true;
      recognitionRef.current.start();
      setListening(true);
      setVoiceStatus({ message: 'Escuchando...', kind: 'ok' });
      showToast('Escuchando...', 'info');
    } catch (error) {
      if (error?.name !== 'InvalidStateError') {
        showToast('No se pudo iniciar el reconocimiento de voz.', 'bad');
      }
      listeningRef.current = false;
    }
  }, [initSpeech, showToast, stopListening]);

  return { listening, stopListening, toggleListening, voiceStatus, speechSupported };
}
