import { useState } from "react";
import { validateWebUrl } from "./domain/targets";
import { Icon } from "./ui";

/** Key this component by the website URL so editing it resets a failed load. */
export function WebsiteIcon({ url }: { url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (failed || !validateWebUrl(url)) return <Icon name="globe" size={22} />;

  return (
    <span className="website-icon" aria-hidden="true">
      {!loaded && <Icon name="globe" size={22} />}
      <img
        className={loaded ? "is-loaded" : undefined}
        src={new URL("/favicon.ico", url).href}
        alt=""
        width={22}
        height={22}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </span>
  );
}
