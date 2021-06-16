import React, { useContext, useEffect, useState } from 'react';
import Konva from 'konva';
import { useTheme } from '@scaleflex/ui/theme/hooks';

import * as CustomKonvaFilters from '../../custom/filters';
import Loading from '../Loading';
import Context from '../../context';

let timeout = null;
const MAIN_CANVAS_ID = 'filerobot-image-editor_main-canvas';

// TODO: Move to constants & props in (px).
const MAX_CANVAS_WIDTH = 800;
const MAX_CANVAS_HEIGHT = 800;

const MainCanvas = ({ image }) => {
  const {
    updateState,
    imageLayer,
    canvasedImage,
    designLayer,
    transformer,
    selections = [],
    canvas,
    finetune,
    tmpAnnotate
  } = useContext(Context);
  const theme = useTheme();
  const [preparedImage, setPreparedImage] = useState(null);

  useEffect(() => {
    if (!image) {
      throw new Error('`image` property must be provided');
    }

    if (typeof image === 'string') {
      const imageElement = new Image();
      imageElement.src = image;
      imageElement.crossOrigin = 'Anonymous';
      imageElement.onload = () => {
        changeImage(imageElement);
      }
      imageElement.onerror = () => {
        changeImage(false);
        throw new Error(`Issue while loading the provided image with the following url: ${image}`);
      }
    } else {
      changeImage(image);
    }
  }, [image]);

  useEffect(() => {
    if (!canvas && preparedImage) {
      const canvas = new Konva.Stage({
        container: MAIN_CANVAS_ID,
        width: preparedImage.width,
        height: preparedImage.height
      });

      const imageLayer = new Konva.Layer(); // for having the image and applying filters
      canvas.add(imageLayer);

      const designLayer = new Konva.Layer(); // for having the other tools for editing ex. shapes, drawing...etc.
      canvas.add(designLayer);

      const transformer = new Konva.Transformer({
        centeredScaling: false,
        rotationSnaps: [0, 90, 180, 270],
        nodes: [],
        anchorStroke: theme.palette['borders-strong'],
        anchorFill: theme.palette['accent-primary'],
        anchorSize: 11,
        anchorCornerRadius: 5,
        borderStroke: theme.palette['access-primary'],
        padding: 1,
        borderDash: [3, 20, 7],
        ignoreStroke: false,
      });

      transformer.on('transform', (e) => {
        if (timeout) { clearTimeout(timeout); }
        timeout = setTimeout(() => { updateState({ selections: [e.target] }); }, 50);
      });

      designLayer.add(transformer);

      const canvasedImage = new Konva.Image({
        image: preparedImage,
        x: 0,
        y: 0,
      });
      canvasedImage.cache();

      imageLayer.add(canvasedImage);
      
      updateState({
        canvas,
        designLayer,
        imageLayer,
        canvasedImage: canvasedImage,
        transformer,
      });
    } else if (preparedImage) {
      canvas.height(preparedImage.height);
      canvas.width(preparedImage.height);
      canvasedImage.image(preparedImage);
    }
  }, [preparedImage, theme.palette]);

  useEffect(() => {
    if (canvas && imageLayer) {
      const latestFinetune = Object.keys(finetune);
      latestFinetune.forEach((filter) => {
        Object.keys(finetune[filter]).forEach((functionName) => {
          imageLayer[functionName](finetune[filter][functionName]);
        })
      });
      imageLayer.filters(latestFinetune.map((f) => Konva.Filters[f] ?? CustomKonvaFilters[f]));
    }
  }, [finetune, imageLayer, canvas]);

  useEffect(() => {
    if (canvas && imageLayer && designLayer && tmpAnnotate) {
      const canvasDimensions = canvas.content.getBoundingClientRect();
      
      const { libClassName, eventsToApply, ...annotate} = tmpAnnotate;
      const shape = new Konva[libClassName]({
        ...annotate,
        x: annotate.x ? annotate.x - canvasDimensions.x : 0,
        y: annotate.y ? annotate.y - canvasDimensions.y : 0,
      });

      // Applying events on the object.
      Object.keys(eventsToApply).forEach((eventName) => {
        shape.on(eventName, eventsToApply[eventName]);
      })

      designLayer.add(shape);

      updateState((state) => ({
        annotations: {
          ...state.annotations,
          [annotate.id]: shape
        },
        tmpAnnotate: null
      }));
    }
  }, [tmpAnnotate, designLayer, imageLayer, canvas]);

  useEffect(() => {
    if (transformer) {
      transformer.nodes(selections)
    }
  }, [transformer, selections]);

  const changeImage = (loadedImage) => {
    const ratio = loadedImage.height / loadedImage.width;
    
    const originalImage = {
      src: loadedImage.src,
      width: loadedImage.width,
      height: loadedImage.height,
      ratio
    }

    const isVerticalImage = ratio > 1;

    if (loadedImage.width > MAX_CANVAS_WIDTH && !isVerticalImage) {
      loadedImage.width = MAX_CANVAS_WIDTH;
      loadedImage.height = ratio * loadedImage.width;
    }

    if (loadedImage.height > MAX_CANVAS_HEIGHT && isVerticalImage) {
      loadedImage.height = MAX_CANVAS_HEIGHT;
      loadedImage.width = loadedImage.height / ratio;
    }
    
    setPreparedImage(loadedImage);

    updateState({
      originalImage // the original image provided.
    });
  }

   // TODO: Make a separate Error compoennt.
   if (preparedImage === false) {
    return (
      <div>
        Error in loading provided image.
      </div>
    )
  }

  // TODO: Make better loading content to be like (Creating preview... 🔃) or (Loading image... 🔃)
  if (!preparedImage) {
    return <Loading />
  }

  return <div id={MAIN_CANVAS_ID} />
}

export default MainCanvas;