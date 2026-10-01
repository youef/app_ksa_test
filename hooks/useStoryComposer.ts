import { useCallback, useMemo, useReducer } from 'react';
import * as ImagePicker from 'expo-image-picker';
import {
  createImageSlide,
  createTextSlide,
  hasRoomForMore,
  isInitialState,
  isSlideValid,
} from '@/lib/storySlides';
import { STORY_LIMITS, type StorySlide } from '@/lib/storyTypes';

interface State {
  slides: StorySlide[];
  activeIdx: number;
}

type Action =
  | { type: 'patchActive'; patch: Partial<StorySlide> }
  | { type: 'setActive'; index: number }
  | { type: 'append'; slides: StorySlide[]; focus?: 'firstNew' | 'none' }
  | { type: 'appendText'; currentCount: number }
  | { type: 'remove'; index: number }
  | { type: 'reset' };

const initialState: State = { slides: [createTextSlide(0)], activeIdx: 0 };

function clampIndex(index: number, length: number): number {
  if (length === 0) return 0;
  return Math.min(Math.max(index, 0), length - 1);
}

function appendSlides(state: State, incoming: StorySlide[], focus: 'firstNew' | 'none'): State {
  if (incoming.length === 0) return state;

  const room = Math.max(0, STORY_LIMITS.maxSlides - state.slides.length);
  const batch = incoming.slice(0, room);
  if (batch.length === 0) return state;

  if (isInitialState(state.slides)) {
    return { slides: batch, activeIdx: 0 };
  }

  const slides = [...state.slides, ...batch];
  const activeIdx =
    focus === 'firstNew' ? state.slides.length : clampIndex(state.activeIdx, slides.length);

  return { slides, activeIdx };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'patchActive': {
      const target = state.activeIdx;
      return {
        ...state,
        slides: state.slides.map((s, i) => (i === target ? { ...s, ...action.patch } : s)),
      };
    }

    case 'setActive':
      return { ...state, activeIdx: clampIndex(action.index, state.slides.length) };

    case 'append':
      return appendSlides(state, action.slides, action.focus ?? 'none');

    case 'appendText':
      return appendSlides(state, [createTextSlide(action.currentCount)], 'firstNew');

    case 'remove': {
      if (state.slides.length <= 1) return initialState;

      const slides = state.slides.filter((_, i) => i !== action.index);
      const removedBeforeActive = action.index < state.activeIdx;
      const activeIdx = clampIndex(
        removedBeforeActive ? state.activeIdx - 1 : state.activeIdx,
        slides.length,
      );
      return { slides, activeIdx };
    }

    case 'reset':
      return initialState;
  }
}

export function useStoryComposer() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const activeSlide = state.slides[state.activeIdx] ?? state.slides[0];
  const validCount = useMemo(
    () => state.slides.filter(isSlideValid).length,
    [state.slides],
  );

  const patchActiveSlide = useCallback((patch: Partial<StorySlide>) => {
    dispatch({ type: 'patchActive', patch });
  }, []);

  const selectSlide = useCallback((index: number) => {
    dispatch({ type: 'setActive', index });
  }, []);

  const stepSlide = useCallback((delta: number) => {
    dispatch({ type: 'setActive', index: state.activeIdx + delta });
  }, [state.activeIdx]);

  const addTextSlide = useCallback(() => {
    dispatch({ type: 'appendText', currentCount: state.slides.length });
  }, [state.slides.length]);

  const removeSlide = useCallback((index: number) => {
    dispatch({ type: 'remove', index });
  }, []);

  const requestAddImages = useCallback((assets: ImagePicker.ImagePickerAsset[]) => {
    if (assets.length === 0) return;
    dispatch({
      type: 'append',
      slides: assets.map((a) => createImageSlide(a.uri, a.base64)),
      focus: 'firstNew',
    });
  }, []);

  const attachImageToActiveSlide = useCallback((asset: ImagePicker.ImagePickerAsset) => {
    const { id: _id, type: _type, content: _content, bgGradId: _grad, ...image } =
      createImageSlide(asset.uri, asset.base64);
    dispatch({ type: 'patchActive', patch: { ...image, type: 'image' } });
  }, []);

  const pickImages = useCallback(async (): Promise<boolean> => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: STORY_LIMITS.pickerSelectionLimit,
      quality: 0.85,
      base64: true,
    });
    if (res.canceled || !res.assets?.length) return false;
    requestAddImages(res.assets);
    return true;
  }, [requestAddImages]);

  const takePhoto = useCallback(async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return false;

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
      base64: true,
    });
    if (res.canceled || !res.assets?.length) return false;

    // Attach to the slide being edited when it has no image yet, otherwise append.
    if (activeSlide?.type === 'image' && !activeSlide.imageUri) {
      attachImageToActiveSlide(res.assets[0]);
    } else {
      requestAddImages([res.assets[0]]);
    }
    return true;
  }, [activeSlide, attachImageToActiveSlide, requestAddImages]);

  const setActiveSlideType = useCallback(
    async (type: StorySlide['type']) => {
      patchActiveSlide({ type });
      if (type === 'image' && !activeSlide?.imageUri) await pickImages();
    },
    [activeSlide, patchActiveSlide, pickImages],
  );

  return {
    slides: state.slides,
    activeIdx: state.activeIdx,
    activeSlide,
    validCount,
    isReady: validCount > 0,
    atCapacity: !hasRoomForMore(state.slides),
    patchActiveSlide,
    selectSlide,
    stepSlide,
    addTextSlide,
    removeSlide,
    pickImages,
    takePhoto,
    setActiveSlideType,
  };
}

export type StoryComposer = ReturnType<typeof useStoryComposer>;
