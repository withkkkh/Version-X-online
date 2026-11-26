// Shared by the asset builder and the tour player. Keep this object valid JSON.
// One attention cue: rise, brief pause, settle. No spring or continuous loop.
// Same meaning -> same motion: https://www.carbondesignsystem.com/building-blocks/foundations/motion/choreography
// These values are exhibition-specific choices, not durations prescribed by Carbon.
export const TOUR_ATTENTION = {
  "duration": 1.4,
  "rise": 0.4,
  "hold": 0.16,
  "distance": 0.14,
  "arrivalDelay": 0.12,
  "easing": [0.4, 0, 0.2, 1]
};
