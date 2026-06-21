import { Composition } from "remotion";
import { Reel } from "./Reel";
import reel from "./data/reel.json";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={reel.durationInFrames}
      fps={reel.fps}
      width={reel.width}
      height={reel.height}
      defaultProps={{}}
    />
  );
};
