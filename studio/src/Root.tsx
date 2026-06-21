import { Composition } from "remotion";
import { Reel } from "./Reel";
import { Avatar } from "./Avatar";
import reel from "./data/reel.json";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Reel"
        component={Reel}
        durationInFrames={reel.durationInFrames}
        fps={reel.fps}
        width={reel.width}
        height={reel.height}
        defaultProps={{}}
      />
      <Composition
        id="Avatar"
        component={Avatar}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1080}
        defaultProps={{}}
      />
    </>
  );
};
