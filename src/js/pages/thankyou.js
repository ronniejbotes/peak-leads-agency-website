/*
 * Peak Leads - src/js/pages/thankyou.js
 * Entry for /thank-you/, the page Calendly sends people to once a call is
 * actually booked. subpage.js is imported for its side effects: styles, nav
 * burger, footer year, email links and the book band (this page has no #book,
 * so that one returns immediately).
 *
 * Three jobs beyond that, all of them about the video:
 *
 *   Hero autoplay   The hero starts on its own about two seconds in. It tries
 *                    with sound first, because that is what the video is for,
 *                    and falls back to muted the moment the browser refuses -
 *                    which it will for most visitors, since arriving from
 *                    Calendly is a navigation and carries no user gesture.
 *                    When it lands muted, a "Tap for sound" button appears and
 *                    the video RESTARTS FROM 0 when it is pressed. Without the
 *                    restart somebody who unmutes at 0:08 has already missed
 *                    the opening line, which is the whole hook.
 *   Poster upgrade  Same trick as the VSL on the homepage: the answer videos
 *                    ship a 400px poster and are upgraded to 960px only once
 *                    they are close enough to be worth it. The hero ships the
 *                    960px file directly, because it is above the fold and
 *                    would be upgraded on the first observer callback anyway.
 *   One at a time   Starting any video pauses every other one, so two answers
 *                    can never talk over each other.
 */
import './subpage.js';

/* Long enough that the page has painted and the visitor has registered the
   confirmation before anything starts talking at them. */
const AUTOPLAY_DELAY = 2000;

/* ====================================================================
 * Posters
 * ================================================================== */

function attachPoster(video, hd) {
  if (!video) return;
  const src =
    (hd && video.getAttribute('data-poster-hd')) || video.getAttribute('data-poster');
  if (src && video.getAttribute('poster') !== src) video.setAttribute('poster', src);
}

/* The 960px file is enough unless the box, in device pixels, is wider than
   that. Measured at attach time rather than up front, because the box is a
   different size on a phone held either way round. */
function upgradePoster(video) {
  const width = video.clientWidth || video.getBoundingClientRect().width;
  attachPoster(video, width > 480 && width * (window.devicePixelRatio || 1) > 960);
}

function initPosters() {
  const videos = document.querySelectorAll('.ty-video video[data-poster]');
  if (!videos.length) return;

  if (!('IntersectionObserver' in window)) {
    for (let i = 0; i < videos.length; i++) upgradePoster(videos[i]);
    return;
  }

  const observer = new window.IntersectionObserver(
    (entries) => {
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          observer.unobserve(entries[i].target);
          upgradePoster(entries[i].target);
        }
      }
    },
    { rootMargin: '100% 0px' }
  );
  for (let i = 0; i < videos.length; i++) observer.observe(videos[i]);
}

/* ====================================================================
 * One at a time
 * ================================================================== */

function initExclusivePlayback() {
  const videos = document.querySelectorAll('.ty-video video');
  if (videos.length < 2) return;

  for (let i = 0; i < videos.length; i++) {
    videos[i].addEventListener('play', (event) => {
      for (let j = 0; j < videos.length; j++) {
        if (videos[j] !== event.target && !videos[j].paused) videos[j].pause();
      }
    });
  }
}

/* ====================================================================
 * Hero autoplay
 * ================================================================== */

function initHeroAutoplay() {
  const figure = document.querySelector('[data-hero-video]');
  if (!figure) return;
  const video = figure.querySelector('video');
  const unmute = figure.querySelector('[data-unmute]');
  if (!video) return;

  /* Set the moment the visitor does anything with the player themselves.
     After that the script stops making decisions for them: no autoplay, and
     no restart-on-unmute stealing a position they chose.

     This listens for real input, NOT for media events. play, pause and
     volumechange all fire for the script's own calls too, so using them here
     made the script mistake itself for the visitor. */
  let taken = false;
  const takeOver = () => {
    taken = true;
  };
  ['pointerdown', 'keydown', 'click'].forEach((type) =>
    figure.addEventListener(type, takeOver, { once: true, capture: true })
  );

  function showUnmute() {
    if (!unmute) return;
    unmute.hidden = false;
    figure.setAttribute('data-muted', '');
  }

  function hideUnmute() {
    if (!unmute) return;
    unmute.hidden = true;
    figure.removeAttribute('data-muted');
  }

  /* The button exists to answer one question: is this thing playing at me
     with no sound? So it is driven by what the element is actually doing,
     never by whether the script thinks it is in charge. Gating this on the
     takeover flag let a touch-scroll that happened to start on the video
     suppress the button while the hero played on silently. */
  function syncUnmute() {
    if (!video.paused && (video.muted || video.volume === 0)) showUnmute();
    else hideUnmute();
  }

  /* Sound on, from the top. The restart is the point of this function. */
  if (unmute) {
    unmute.addEventListener('click', () => {
      video.muted = false;
      video.volume = 1;
      try {
        video.currentTime = 0;
      } catch (err) {
        /* Seeking before enough is buffered throws in older WebKit. Playing
           from wherever it is beats not playing at all. */
      }
      hideUnmute();
      const played = video.play();
      if (played && typeof played.catch === 'function') {
        /* A press is a user gesture, so this all but always succeeds. If some
           browser still refuses, go back to playing muted with the button up
           rather than leaving a silent, paused video and no way back. */
        played.catch(() => {
          video.muted = true;
          const retry = video.play();
          if (retry && typeof retry.catch === 'function') retry.catch(() => {});
          syncUnmute();
        });
      }
    });
  }

  /* Anything that changes the sound or the playing state later - the native
     controls, a keyboard, another video pausing this one - brings the button
     back or takes it away to match. `play` is in here as well as `pause`:
     without it, pausing a silent hero on the native controls and then
     resuming it left the button hidden while it carried on playing muted,
     because resuming fires no volumechange. */
  ['volumechange', 'play', 'pause'].forEach((type) =>
    video.addEventListener(type, syncUnmute)
  );

  function anotherVideoPlaying() {
    const all = document.querySelectorAll('.ty-video video');
    for (let i = 0; i < all.length; i++) {
      if (all[i] !== video && !all[i].paused) return true;
    }
    return false;
  }

  function onScreen() {
    const box = figure.getBoundingClientRect();
    const height = window.innerHeight || document.documentElement.clientHeight;
    return box.bottom > 0 && box.top < height;
  }

  function start() {
    if (taken || !video.paused) return;

    /* The visitor left the tab during the two second wait. Spending the one
       autoplay now would mean the hero talks to an empty room and is half
       over when they come back. Wait for them instead. */
    if (document.hidden) {
      document.addEventListener('visibilitychange', () => start(), { once: true });
      return;
    }

    /* They have already jumped to the questions - the nav CTA links straight
       to #questions - so the hero is off screen. Starting it now means a
       voice from somewhere above them. Wait until it is back in view. */
    if (!onScreen()) {
      if (!('IntersectionObserver' in window)) return;
      const observer = new window.IntersectionObserver(
        (entries) => {
          for (let i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) {
              observer.disconnect();
              start();
              return;
            }
          }
        },
        { threshold: 0.2 }
      );
      observer.observe(figure);
      return;
    }

    /* They started one of the answers themselves in the meantime. Do not
       hijack it: one-at-a-time would pause the video they actually chose. */
    if (anotherVideoPlaying()) return;

    /* With sound first. This succeeds only where the browser already trusts
       the site (Chrome's media engagement score), which is a minority of
       visitors - so the muted path below is the one that usually runs. */
    video.muted = false;
    const played = video.play();

    if (!played || typeof played.then !== 'function') {
      /* No promise to inspect (older browsers). If it did not actually
         start, treat it as refused. */
      if (video.paused) muteAndPlay();
      else syncUnmute();
      return;
    }

    played.then(
      /* Some browsers honour play() but mute it themselves rather than
         rejecting, so the button still has to appear. */
      () => syncUnmute(),
      () => muteAndPlay()
    );
  }

  function muteAndPlay() {
    if (taken || !video.paused) return;
    video.muted = true;
    const played = video.play();

    if (played && typeof played.then === 'function') {
      played.then(syncUnmute, () => {
        /* Even muted playback was refused - iOS low power mode, Data Saver.
           Put the mute back the way it was found, so that when the visitor
           presses play themselves they get sound rather than a silent video
           with no button offering to turn it on. */
        video.muted = false;
        hideUnmute();
      });
      return;
    }
    syncUnmute();
  }

  /* A tab opened in the background must not spend its one autoplay while
     nobody is looking: wait until the page is actually on screen. */
  if (document.hidden) {
    document.addEventListener(
      'visibilitychange',
      () => window.setTimeout(start, AUTOPLAY_DELAY),
      { once: true }
    );
  } else {
    window.setTimeout(start, AUTOPLAY_DELAY);
  }
}

function init() {
  initPosters();
  initExclusivePlayback();
  initHeroAutoplay();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
