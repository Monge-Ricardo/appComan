/* ==========================================================================
   SINTETIZADOR WEB AUDIO API - COMANDANTE DRUM PADS
   ========================================================================== */

const DrumAudio = {
  ctx: null,
  enabled: true,

  // Inicializacion perezosa del contexto de audio (debido a las politicas de navegadores)
  init() {
    if (!this.ctx) {
      // Soporte multiplataforma para AudioContext
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Si el contexto esta suspendido por politicas del navegador, reanudarlo
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  },

  // Alternar el sonido encendido/apagado
  toggle() {
    this.enabled = !this.enabled;
    localStorage.setItem('drum_audio_enabled', this.enabled);
    return this.enabled;
  },

  // Cargar estado guardado de audio en el navegador
  loadState() {
    const saved = localStorage.getItem('drum_audio_enabled');
    if (saved !== null) {
      this.enabled = saved === 'true';
    }
  },

  // 1. Sonido para Clic Corto (Participación) - Tono percusivo rapido
  playParticipation() {
    if (!this.enabled) return;
    this.init();
    
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Configuracion de onda y frecuencia descendente (sonido electronico limpio)
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, ctx.currentTime); // Empieza en La (440Hz)
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08); // Cae rapido

    // Envolvente de volumen (ataque y caida rapida)
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
  },

  // 2. Sonido para Clic Largo (Punto Extra) - Acorde brillante ascendente tipo campana
  playExtraPoint() {
    if (!this.enabled) return;
    this.init();
    
    const ctx = this.ctx;
    if (!ctx) return;

    // Usamos dos osciladores para crear un acorde armonico de campana (Intervalo de Quinta)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Oscilador 1: Tono base (C5 -> E5)
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, ctx.currentTime); // Do 5
    osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.25); // Mi 5

    // Oscilador 2: Tono armonico (G5 -> Si5)
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, ctx.currentTime); // Sol 5
    osc2.frequency.exponentialRampToValueAtTime(987.77, ctx.currentTime + 0.25); // Si 5

    // Envolvente de campana (ataque suave, resonancia y caida exponencial larga)
    gainNode.gain.setValueAtTime(0.18, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.06);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);
    
    osc1.stop(ctx.currentTime + 0.36);
    osc2.stop(ctx.currentTime + 0.36);
  },

  // 3. Sonido para Deshacer (Undo) - Tono electronico descendente bajo
  playUndo() {
    if (!this.enabled) return;
    this.init();
    
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.18);

    gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  }
};

// Cargar estado inicial
DrumAudio.loadState();
