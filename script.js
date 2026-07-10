(function () {
  'use strict';

  const STORY_STEPS = [
    { type: 'intro', audioKey: 'aud-0', minDuration: 3000, speaker: null, showQuestions: true },
    { type: 'intro', reveal: 'healthy', audioKey: 'aud-2', minDuration: 3000, speaker: 'healthy' },
    { type: 'intro', reveal: 'eti',     audioKey: 'aud-3', minDuration: 3000, speaker: 'eti' },
    { type: 'intro', reveal: 'safy',    audioKey: 'aud-4', minDuration: 3000, speaker: 'safy' },
    { type: 'activities' },
    { type: 'ending', audioKey: 'aud-1', minDuration: 3500 }
  ];

  const ACTIVITY_IMAGES = [
    'image/활동1.jpg', 'image/활동2.jpg', 'image/활동3.jpg',
    'image/활동4.jpg', 'image/활동5.jpg', 'image/활동6.jpg', 'image/활동7.jpg'
  ];

  const ACTIVITY_SLIDE_MS = 2800;
  const ACTIVITY_CROSSFADE_MS = 1600;

  const AUDIO_SRC = {
    'aud-0': 'sound/audio_0.mp3',
    'aud-1': 'sound/audio_1_놀면서 배우는 올바른 영양 습관, 우리 함께 해요.mp3',
    'aud-2': 'sound/audio_2_안녕, 난 헬씨야, 몸을 튼튼하게 만드는 영양소 친구들을 만나볼까.mp3',
    'aud-3': 'sound/audio_3_eti.mp3',
    'aud-4': 'sound/audio_4_안녕, 난 세이피! 깨끗한 손과 안전한 식습관은 기본이지!.mp3'
  };

  const AUDIO_GAIN = {
    'aud-0': 1,
    'aud-1': 1,
    'aud-2': 1.55,
    'aud-3': 1.55,
    'aud-4': 1.55
  };

  /* Kenney Interface Sounds (CC0) — https://kenney.nl/assets/interface-sounds */
  const SFX = {
    cheer:  { src: 'sound/sfx/confirmation_002.ogg', volume: 0.48 },
    click:  { src: 'sound/sfx/click_001.ogg',        volume: 0.45 }
  };

  const sceneMap = {};
  document.querySelectorAll('.scene').forEach(function (el) {
    sceneMap[el.dataset.scene] = el;
  });

  const progressFill = document.getElementById('progress-fill');
  const activityLayerA = document.getElementById('activity-layer-a');
  const activityLayerB = document.getElementById('activity-layer-b');
  const dots = document.querySelectorAll('.dot');
  const confettiContainer = document.getElementById('confetti');
  const storyApp = document.getElementById('story-app');
  const replayBtn = document.getElementById('btn-replay');
  const audioKeeper = document.getElementById('aud-unlock');

  const audioMap = {
    'aud-0': document.getElementById('aud-0'),
    'aud-1': document.getElementById('aud-1'),
    'aud-2': document.getElementById('aud-2'),
    'aud-3': document.getElementById('aud-3'),
    'aud-4': document.getElementById('aud-4')
  };

  let currentAudio = null;
  let isPlaying = false;
  let audioUnlocked = false;
  let userInteracted = false;
  let unlockWaiters = [];
  let audioContext = null;
  const audioGains = {};
  let confettiTimer = null;
  let pendingAudioKey = null;
  let activeAudioKey = null;
  let audioSessionReady = false;

  function startAudioKeeper() {
    if (!audioKeeper || audioSessionReady) return Promise.resolve(audioSessionReady);
    audioKeeper.loop = true;
    audioKeeper.muted = true;
    audioKeeper.volume = 0;
    return audioKeeper.play().then(function () {
      audioSessionReady = true;
      audioUnlocked = true;
      return true;
    }).catch(function () {
      return false;
    });
  }

  function pauseAudioKeeper() {
    if (!audioKeeper || audioKeeper.paused) return;
    audioKeeper.pause();
  }

  function resumeAudioKeeper() {
    if (!audioKeeper || !audioSessionReady) return;
    audioKeeper.muted = true;
    audioKeeper.volume = 0;
    audioKeeper.play().catch(function () {});
  }

  function primeAutoplay() {
    var loadAud0 = waitForCanPlay(ensureAudioSource('aud-0'));
    Object.keys(AUDIO_SRC).forEach(function (key) {
      if (key !== 'aud-0') waitForCanPlay(ensureAudioSource(key));
    });

    return Promise.race([
      Promise.all([
        loadAud0,
        audioKeeper ? waitForCanPlay(audioKeeper) : Promise.resolve(true)
      ]).then(function () {
        return startAudioKeeper();
      }).then(function () {
        var probe = audioMap['aud-0'];
        if (!probe) return;

        probe.muted = true;
        probe.volume = 0;
        return probe.play().then(function () {
          probe.pause();
          probe.currentTime = 0;
          audioUnlocked = true;
          audioSessionReady = true;
        }).catch(function () {}).then(function () {
          probe.muted = false;
          probe.volume = 1;
          return startAudioKeeper();
        });
      }),
      delay(6000)
    ]).then(function () {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      var ctx = new AudioCtx();
      var buffer = ctx.createBuffer(1, 1, 22050);
      var source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      return ctx.resume().catch(function () {}).then(function () {
        return ctx.close();
      });
    });
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function stopAllAudio() {
    Object.keys(audioMap).forEach(function (key) {
      var el = audioMap[key];
      el.pause();
      el.currentTime = 0;
    });
    currentAudio = null;
  }

  function stopVoiceAudio() {
    stopAllAudio();
  }

  function waitForUnlock() {
    if (userInteracted) return Promise.resolve();
    return new Promise(function (resolve) {
      unlockWaiters.push(resolve);
    });
  }

  function unlockAudio() {
    userInteracted = true;
    audioUnlocked = true;
    unlockWaiters.forEach(function (resolve) { resolve(); });
    unlockWaiters = [];

    startAudioKeeper().then(function () {
      if (pendingAudioKey) {
        var key = pendingAudioKey;
        pendingAudioKey = null;
        playAudio(key).catch(function () {});
        return;
      }

      if (currentAudio && !currentAudio.ended) {
        currentAudio.muted = false;
        if (activeAudioKey) applyAudioVolume(currentAudio, activeAudioKey);
        currentAudio.play().catch(function () {});
      }
    });
  }

  function waitForCanPlay(el) {
    return new Promise(function (resolve) {
      if (el.readyState >= 3 && !el.error) { resolve(true); return; }
      if (el.readyState >= 2 && !el.error) { resolve(true); return; }
      var timeout = setTimeout(function () { cleanup(); resolve(!el.error); }, 8000);
      function cleanup() {
        clearTimeout(timeout);
        el.removeEventListener('canplaythrough', onReady);
        el.removeEventListener('canplay', onReady);
        el.removeEventListener('error', onError);
      }
      function onReady() { cleanup(); resolve(!el.error); }
      function onError() {
        console.warn('오디오 로드 실패:', el.currentSrc || el.src, el.error);
        cleanup();
        resolve(false);
      }
      el.addEventListener('canplaythrough', onReady);
      el.addEventListener('canplay', onReady);
      el.addEventListener('error', onError);
      if (el.readyState === 0) el.load();
    });
  }

  function ensureAudioSource(audioKey) {
    var el = audioMap[audioKey];
    var src = AUDIO_SRC[audioKey];
    if (!el || !src) return el;

    var resolved = new URL(src, window.location.href).href;
    if (el.dataset.resolvedSrc === resolved) return el;

    var current = el.currentSrc || el.getAttribute('src') || el.src || '';
    if (current) {
      try {
        if (new URL(current, window.location.href).href === resolved) {
          el.dataset.resolvedSrc = resolved;
          return el;
        }
      } catch (err) {}
    }

    el.src = src;
    el.dataset.resolvedSrc = resolved;
    el.load();
    return el;
  }

  function setupAudioElements() {
    Object.keys(AUDIO_SRC).forEach(function (key) {
      ensureAudioSource(key);
    });
  }

  function initAudioGraph() {
    if (audioContext) return;

    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    audioContext = new AudioCtx();
    Object.keys(audioMap).forEach(function (key) {
      var el = audioMap[key];
      if (!el) return;
      try {
        var source = audioContext.createMediaElementSource(el);
        var gain = audioContext.createGain();
        source.connect(gain);
        gain.connect(audioContext.destination);
        audioGains[key] = gain;
      } catch (err) {
        console.warn('Web Audio 연결 실패:', key, err);
      }
    });
  }

  function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(function () {});
    }
  }

  function applyAudioVolume(el, audioKey) {
    var gainValue = AUDIO_GAIN[audioKey] !== undefined ? AUDIO_GAIN[audioKey] : 1;
    if (audioGains[audioKey]) {
      el.volume = 1;
      audioGains[audioKey].gain.value = gainValue;
    } else {
      el.volume = Math.min(1, gainValue);
    }
  }

  function playSfx(key) {
    var cfg = SFX[key];
    if (!cfg) return;
    resumeAudioContext();
    var el = new Audio(cfg.src);
    el.volume = cfg.volume;
    el.play().catch(function () {});
  }

  function playWithTimeout(el, ms) {
    return Promise.race([
      el.play(),
      delay(ms).then(function () {
        return Promise.reject(new Error('play-timeout'));
      })
    ]);
  }

  function startAudioPlayback(el, audioKey) {
    return startAudioKeeper().then(function () {
      pauseAudioKeeper();
      el.muted = true;
      el.volume = 0;

      return playWithTimeout(el, 4000).then(function () {
        el.muted = false;
        applyAudioVolume(el, audioKey);
        audioUnlocked = true;
        audioSessionReady = true;
        pendingAudioKey = null;
        return true;
      }).catch(function (err) {
        el.muted = false;
        resumeAudioKeeper();
        if (err && err.name === 'NotAllowedError') {
          pendingAudioKey = audioKey;
          return false;
        }
        console.warn('play 실패:', audioKey, err);
        return false;
      });
    });
  }

  function waitForAudioEnd(el, audioKey) {
    var fallbackMs = 15000;
    if (el.duration && isFinite(el.duration) && el.duration > 0) {
      fallbackMs = Math.ceil(el.duration * 1000) + 2500;
    }

    return Promise.race([
      new Promise(function (resolve) {
        function cleanup(result) {
          el.removeEventListener('ended', onEnd);
          el.removeEventListener('error', onError);
          resolve(result);
        }
        function onEnd() { cleanup(true); }
        function onError() {
          console.warn('오디오 재생 중 오류:', audioKey, el.currentSrc || el.src);
          cleanup(false);
        }
        el.addEventListener('ended', onEnd);
        el.addEventListener('error', onError);
      }),
      delay(fallbackMs).then(function () {
        console.warn('오디오 종료 대기 시간 초과:', audioKey);
        el.pause();
        return false;
      })
    ]);
  }

  async function playAudioElement(el, audioKey) {
    stopVoiceAudio();
    ensureAudioSource(audioKey);
    currentAudio = el;
    el.currentTime = 0;

    var ready = await waitForCanPlay(el);
    if (!ready) {
      ensureAudioSource(audioKey);
      ready = await waitForCanPlay(el);
    }
    if (!ready) {
      resumeAudioKeeper();
      return false;
    }

    var started = await startAudioPlayback(el, audioKey);
    if (!started) return false;

    var ended = await waitForAudioEnd(el, audioKey);
    resumeAudioKeeper();
    return ended;
  }

  async function playAudio(audioKey) {
    if (!audioKey) return false;
    var el = ensureAudioSource(audioKey);
    if (!el) return false;

    activeAudioKey = audioKey;
    pendingAudioKey = null;

    for (var attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await delay(200 * attempt);
      var result = await playAudioElement(el, audioKey);
      if (result === true) return true;
    }

    if (pendingAudioKey === audioKey) {
      await Promise.race([waitForUnlock(), delay(3000)]);
      pendingAudioKey = null;
      if (userInteracted) {
        return await playAudioElement(el, audioKey) === true;
      }
    }

    return false;
  }

  async function playAudioWithLimit(audioKey, maxMs) {
    return Promise.race([
      playAudio(audioKey),
      delay(maxMs).then(function () { return false; })
    ]);
  }

  function showScene(sceneId) {
    Object.keys(sceneMap).forEach(function (id) {
      sceneMap[id].classList.toggle('active', id === sceneId);
    });
  }

  function updateProgress(stepIndex) {
    progressFill.style.width = ((stepIndex + 1) / STORY_STEPS.length) * 100 + '%';
  }

  function revealCastMember(castId) {
    var member = document.querySelector('[data-cast="' + castId + '"]');
    if (!member) return;
    member.classList.add('visible', 'entering');
    window.setTimeout(function () {
      member.classList.remove('entering');
    }, 950);
  }

  function setQuestionMarks(show) {
    document.querySelectorAll('.q-mark-float').forEach(function (mark) {
      mark.style.visibility = show ? 'visible' : 'hidden';
    });
  }

  function setSpeakingCharacter(speakerId) {
    document.querySelectorAll('[data-cast]').forEach(function (el) {
      el.classList.toggle('speaking', el.dataset.cast === speakerId);
      el.classList.remove('entering');
    });
  }

  async function runIntroStep(step, stepIndex) {
    showScene('intro');
    updateProgress(stepIndex);
    if (step.reveal) revealCastMember(step.reveal);

    setQuestionMarks(!!step.showQuestions);

    await delay(stepIndex === 0 ? 600 : 800);
    setSpeakingCharacter(step.speaker || null);

    var start = Date.now();
    var played = await playAudioWithLimit(step.audioKey, step.minDuration + 12000);
    var elapsed = Date.now() - start;
    if (!played || elapsed < step.minDuration) {
      await delay(Math.max(0, step.minDuration - elapsed));
    }

    setSpeakingCharacter(null);
  }

  function updateActivityDisplay(index) {
    dots.forEach(function (dot, i) {
      dot.classList.toggle('active', i === index);
    });
  }

  function preloadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = src;
    });
  }

  function resetActivityLayer(layer) {
    layer.classList.remove('visible', 'enter-first', 'wipe-in');
    layer.style.animation = 'none';
    layer.style.clipPath = '';
  }

  function playActivityWipe(layer, enterClass) {
    layer.style.animation = 'none';
    void layer.offsetWidth;
    layer.style.animation = '';
    layer.classList.add('visible', enterClass);
  }

  async function runActivitiesScene(stepIndex) {
    showScene('activities');
    updateProgress(stepIndex);
    stopVoiceAudio();
    resumeAudioKeeper();

    var layers = [activityLayerA, activityLayerB];
    var activeIndex = 0;

    resetActivityLayer(layers[0]);
    resetActivityLayer(layers[1]);
    layers[1].removeAttribute('src');

    layers[0].src = ACTIVITY_IMAGES[0];
    layers[0].alt = '앱 활동 화면 1';
    updateActivityDisplay(0);

    playSfx('cheer');
    await delay(500);
    playActivityWipe(layers[0], 'enter-first');

    await delay(ACTIVITY_SLIDE_MS);

    for (var i = 1; i < ACTIVITY_IMAGES.length; i++) {
      await preloadImage(ACTIVITY_IMAGES[i]);

      await new Promise(function (resolve) {
        var nextIndex = 1 - activeIndex;
        var currentLayer = layers[activeIndex];
        var nextLayer = layers[nextIndex];

        resetActivityLayer(nextLayer);
        nextLayer.src = ACTIVITY_IMAGES[i];
        nextLayer.alt = '앱 활동 화면 ' + (i + 1);

        requestAnimationFrame(function () {
          playActivityWipe(nextLayer, 'wipe-in');
          updateActivityDisplay(i);
          activeIndex = nextIndex;

          setTimeout(function () {
            resetActivityLayer(currentLayer);
            nextLayer.classList.remove('wipe-in');
            nextLayer.style.clipPath = 'inset(0 0 0 0)';
            resolve();
          }, ACTIVITY_CROSSFADE_MS);
        });
      });

      await delay(ACTIVITY_SLIDE_MS - ACTIVITY_CROSSFADE_MS);
    }
    await delay(800);
  }

  function launchConfetti() {
    var colors = ['#FF6B6B', '#FFB347', '#5B4FCF', '#A8E6CF', '#FFD3B6', '#FFE066'];
    for (var i = 0; i < 40; i++) {
      (function (delayMs) {
        setTimeout(function () {
          var piece = document.createElement('div');
          piece.className = 'confetti-piece';
          piece.style.left = Math.random() * 100 + '%';
          piece.style.background = colors[Math.floor(Math.random() * colors.length)];
          piece.style.animationDuration = (2 + Math.random() * 2) + 's';
          piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
          confettiContainer.appendChild(piece);
          setTimeout(function () { piece.remove(); }, 4000);
        }, delayMs);
      })(i * 80);
    }
  }

  function showReplayButton() {
    if (!replayBtn) return;
    replayBtn.hidden = false;
    requestAnimationFrame(function () {
      replayBtn.classList.add('visible');
    });
  }

  function hideReplayButton() {
    if (!replayBtn) return;
    replayBtn.classList.remove('visible');
    replayBtn.hidden = true;
  }

  function resetStoryState() {
    stopVoiceAudio();
    resumeAudioKeeper();

    if (confettiTimer) {
      clearInterval(confettiTimer);
      confettiTimer = null;
    }
    confettiContainer.innerHTML = '';
    hideReplayButton();

    document.querySelectorAll('[data-cast]').forEach(function (el) {
      el.classList.toggle('visible', el.dataset.cast === 'child' || el.dataset.cast === 'wheelchair');
      el.classList.remove('speaking');
    });

    setQuestionMarks(true);

    resetActivityLayer(activityLayerA);
    activityLayerA.src = ACTIVITY_IMAGES[0];
    activityLayerA.alt = '앱 활동 화면 1';
    activityLayerA.classList.add('visible');
    activityLayerB.removeAttribute('src');
    resetActivityLayer(activityLayerB);
    updateActivityDisplay(0);
    progressFill.style.width = '0';
  }

  async function runEndingScene(step, stepIndex) {
    showScene('ending');
    updateProgress(stepIndex);
    launchConfetti();
    playSfx('cheer');
    confettiTimer = setInterval(launchConfetti, 7000);

    await delay(500);
    var start = Date.now();
    var played = await playAudioWithLimit(step.audioKey, step.minDuration + 12000);
    var elapsed = Date.now() - start;
    if (!played || elapsed < step.minDuration) {
      await delay(Math.max(0, step.minDuration - elapsed));
    }

    await delay(1000);
    showReplayButton();
  }

  async function runStory() {
    for (var i = 0; i < STORY_STEPS.length; i++) {
      var step = STORY_STEPS[i];
      if (step.type === 'intro') {
        await runIntroStep(step, i);
      } else if (step.type === 'activities') {
        await runActivitiesScene(i);
      } else if (step.type === 'ending') {
        await runEndingScene(step, i);
        finishStory();
        return;
      }
    }
  }

  function finishStory() {
    document.dispatchEvent(new CustomEvent('storyComplete', { detail: { skipped: false } }));
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'openingStoryComplete' }, '*');
    }
  }

  function preloadImages() {
    ACTIVITY_IMAGES.forEach(function (src) {
      var img = new Image();
      img.src = src;
    });
  }

  var STAGE_WIDTH = 1000;
  var FEET_FROM_BOTTOM_CAST = 0.07;
  var FEET_FROM_BOTTOM_ENDING = 0.10;

  function getRenderedImageRect(img) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;

    var box = img.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;

    var scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
    var width = img.naturalWidth * scale;
    var height = img.naturalHeight * scale;
    var left = box.left + (box.width - width) / 2;
    var top = box.top + (box.height - height) / 2;

    return {
      left: left,
      top: top,
      width: width,
      height: height,
      bottom: top + height
    };
  }

  function syncScalerToBackground(scalerEl, scaleVar, feetRatio) {
    var bgImg = document.querySelector('.classroom-bg-img');
    var bgRect = getRenderedImageRect(bgImg);
    if (!bgRect || !scalerEl) return false;

    var scale = bgRect.width / STAGE_WIDTH;
    var feetY = bgRect.bottom - bgRect.height * feetRatio;

    scalerEl.style.left = (bgRect.left + bgRect.width / 2) + 'px';
    scalerEl.style.bottom = (window.innerHeight - feetY) + 'px';

    document.documentElement.style.setProperty(scaleVar, String(scale));
    return true;
  }

  function updateLayoutScale() {
    var footer = document.querySelector('.story-footer');
    var footerH = footer ? footer.offsetHeight : 70;
    document.documentElement.style.setProperty('--footer-h', footerH + 'px');

    var pad = 16;
    var availW = window.innerWidth - pad * 2;
    var availH = window.innerHeight - footerH - pad * 2;
    var actScale = Math.min(availW / 680, availH / 470);
    document.documentElement.style.setProperty('--activities-scale', String(actScale));

    syncScalerToBackground(
      document.querySelector('.cast-scaler'),
      '--cast-scale',
      FEET_FROM_BOTTOM_CAST
    );

    syncScalerToBackground(
      document.querySelector('.ending-scaler'),
      '--ending-scale',
      FEET_FROM_BOTTOM_ENDING
    );
  }

  function setupLayoutScale() {
    updateLayoutScale();
    var bgImg = document.querySelector('.classroom-bg-img');
    if (bgImg) {
      if (bgImg.complete) updateLayoutScale();
      else bgImg.addEventListener('load', updateLayoutScale);
    }

    var resizeFrame = null;
    function onViewportChange() {
      if (resizeFrame) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(updateLayoutScale);
    }

    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', function () {
      setTimeout(updateLayoutScale, 150);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportChange);
    }
  }

  function setupAudioUnlock() {
    storyApp.addEventListener('pointerdown', unlockAudio);
    storyApp.addEventListener('keydown', unlockAudio);
    document.addEventListener('pointerdown', unlockAudio, { once: false });
  }

  function setupReplay() {
    if (!replayBtn) return;
    replayBtn.addEventListener('click', function () {
      playSfx('click');
      unlockAudio();
      resetStoryState();
      runStory().catch(function (err) { console.error('스토리 재생 오류:', err); });
    });
  }

  async function init() {
    preloadImages();
    setupAudioElements();
    setupLayoutScale();
    setupAudioUnlock();
    setupReplay();
    try {
      await primeAutoplay();
    } catch (err) {
      console.warn('자동 재생 준비 실패:', err);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopVoiceAudio();
      } else {
        resumeAudioKeeper();
        if (isPlaying && currentAudio && !currentAudio.ended) {
          currentAudio.play().catch(function () {});
        }
      }
    });
    isPlaying = true;
    runStory().catch(function (err) { console.error('스토리 재생 오류:', err); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
