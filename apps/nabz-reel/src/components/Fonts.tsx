import React from "react";
import { AbsoluteFill, staticFile } from "remotion";

export const FontFaces: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <style>{`
      @font-face {
        font-family: 'Mikhak';
        src: url('${staticFile("fonts/Mikhak-Medium.ttf")}') format('truetype');
        font-weight: 500;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Mikhak';
        src: url('${staticFile("fonts/Mikhak-SemiBold.ttf")}') format('truetype');
        font-weight: 600;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Mikhak';
        src: url('${staticFile("fonts/Mikhak-Bold.ttf")}') format('truetype');
        font-weight: 700;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Mikhak';
        src: url('${staticFile("fonts/Mikhak-ExtraBold.ttf")}') format('truetype');
        font-weight: 800;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Mikhak';
        src: url('${staticFile("fonts/Mikhak-Black.ttf")}') format('truetype');
        font-weight: 900;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Inter';
        src: url('${staticFile("fonts/Inter-Regular.ttf")}') format('truetype');
        font-weight: 400;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Inter';
        src: url('${staticFile("fonts/Inter-Medium.ttf")}') format('truetype');
        font-weight: 500;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Inter';
        src: url('${staticFile("fonts/Inter-SemiBold.ttf")}') format('truetype');
        font-weight: 600;
        font-style: normal;
        font-display: block;
      }
      @font-face {
        font-family: 'Inter';
        src: url('${staticFile("fonts/Inter-Bold.ttf")}') format('truetype');
        font-weight: 700;
        font-style: normal;
        font-display: block;
      }
    `}</style>
  </AbsoluteFill>
);
