/* Local Web Audio effects: timber cracks, hull creaks, and water swallowing a wreck. */
(function(root){
  'use strict';
  function createNoise(ctx){
    const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+(Math.random()*2-1)*.02)/1.02;data[i]=last*5;}
    return buffer;
  }
  function shipBreak(ctx,output,noise,when=ctx.currentTime){
    const noiseBurst=(delay,duration,frequency,gain,type='bandpass')=>{
      const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),envelope=ctx.createGain();
      source.buffer=noise;source.loop=true;filter.type=type;filter.frequency.setValueAtTime(frequency,when+delay);filter.frequency.exponentialRampToValueAtTime(Math.max(80,frequency*.35),when+delay+duration);filter.Q.value=.9;
      envelope.gain.setValueAtTime(.0001,when+delay);envelope.gain.exponentialRampToValueAtTime(gain,when+delay+.012);envelope.gain.exponentialRampToValueAtTime(.0001,when+delay+duration);
      source.connect(filter);filter.connect(envelope);envelope.connect(output);source.start(when+delay);source.stop(when+delay+duration+.03);
    };
    // Splintering impacts arrive in an uneven sequence rather than a single cannon-like bang.
    for(const [delay,hz,gain] of [[0,1800,2],[.14,1100,1.4],[.47,2300,1.2],[1.15,900,1.1],[2.1,1400,.7]])noiseBurst(delay,.16,hz,gain,'highpass');
    for(const [delay,frequency] of [[0,160],[.65,115],[1.6,85]]){
      const oscillator=ctx.createOscillator(),filter=ctx.createBiquadFilter(),gain=ctx.createGain();
      oscillator.type='sawtooth';oscillator.frequency.setValueAtTime(frequency,when+delay);oscillator.frequency.exponentialRampToValueAtTime(frequency*.36,when+delay+1.6);
      filter.type='lowpass';filter.frequency.value=650;gain.gain.setValueAtTime(.0001,when+delay);gain.gain.exponentialRampToValueAtTime(.19,when+delay+.12);gain.gain.exponentialRampToValueAtTime(.0001,when+delay+1.6);
      oscillator.connect(filter);filter.connect(gain);gain.connect(output);oscillator.start(when+delay);oscillator.stop(when+delay+1.65);
    }
    noiseBurst(.7,3.6,460,1.6,'lowpass');noiseBurst(2.6,2.4,900,.8,'lowpass');
    return 5.1;
  }
  root.CrescentAudio={shipBreak,createNoise};
})(globalThis);
