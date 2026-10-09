import React from "react";
import { Composition } from "remotion";
import { NabzFardaReel } from "./Reel";
import { FPS, TOTAL_FRAMES } from "./lib/timing";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="NabzFardaReel"
        component={NabzFardaReel}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};
