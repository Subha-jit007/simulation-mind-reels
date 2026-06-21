import { Composition } from "remotion";
import { Reel } from "./Reel";
import { Avatar } from "./Avatar";
import { Wallpaper } from "./Wallpaper";
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
      <Composition
        id="Wallpaper"
        component={Wallpaper}
        durationInFrames={1}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{ line: "You can't escape a simulation from the inside.", palette: "void" }}
      />
    </>
  );
};
