import { useState } from "react";
import { palettes, type Appearance, type ColorMode } from "./appearance";
import { Dialog, Icon, type IconName } from "./ui";

const modes: { id: ColorMode; name: string; icon: IconName }[] = [
  { id: "light", name: "浅色", icon: "sun" },
  { id: "dark", name: "深色", icon: "moon" },
  { id: "system", name: "跟随系统", icon: "monitor" },
];

export function AppearanceSettings({
  appearance,
  onChange,
}: {
  appearance: Appearance;
  onChange: (appearance: Appearance) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="appearance-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Icon name="palette" size={17} />
        <span>外观</span>
      </button>
      {open && (
        <Dialog onClose={() => setOpen(false)}>
          <section
            className="modal appearance-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="appearance-title"
            aria-describedby="appearance-description"
          >
            <header className="appearance-heading">
              <div>
                <h2 id="appearance-title">外观设置</h2>
                <p id="appearance-description">
                  选一套喜欢的配色，让日常查找更顺眼。
                </p>
              </div>
              <button
                className="icon-button"
                aria-label="关闭外观设置"
                onClick={() => setOpen(false)}
              >
                <Icon name="close" />
              </button>
            </header>
            <fieldset className="appearance-fieldset">
              <legend>显示模式</legend>
              <div className="mode-options">
                {modes.map((mode) => (
                  <label className="mode-option" key={mode.id}>
                    <input
                      className="sr-only"
                      type="radio"
                      name="color-mode"
                      value={mode.id}
                      checked={appearance.mode === mode.id}
                      onChange={() =>
                        onChange({ ...appearance, mode: mode.id })
                      }
                    />
                    <span>
                      <Icon name={mode.icon} size={17} />
                      {mode.name}
                    </span>
                  </label>
                ))}
              </div>
              <p className="appearance-hint">每套主题都提供浅色与深色配色。</p>
            </fieldset>
            <fieldset className="appearance-fieldset">
              <legend>主题配色</legend>
              <div className="palette-options">
                {palettes.map((palette) => (
                  <label className="palette-option" key={palette.id}>
                    <input
                      className="sr-only"
                      type="radio"
                      name="palette"
                      value={palette.id}
                      checked={appearance.palette === palette.id}
                      onChange={() =>
                        onChange({ ...appearance, palette: palette.id })
                      }
                    />
                    <span className="palette-choice">
                      <span
                        className="palette-preview"
                        data-palette={palette.id}
                        aria-hidden="true"
                      >
                        <span className="preview-rail">
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="preview-workspace">
                          <span className="preview-toolbar">
                            <i />
                            <b />
                          </span>
                          <span className="preview-content">
                            <i />
                            <i />
                          </span>
                        </span>
                      </span>
                      <span className="palette-caption">
                        <strong>{palette.name}</strong>
                        <span className="palette-check" aria-hidden="true">
                          <Icon name="check" size={14} />
                        </span>
                      </span>
                      <span className="palette-description">
                        {palette.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <footer className="appearance-footer">
              <span>
                <Icon name="check" size={14} />
                即时生效，自动记住选择
              </span>
              <button className="primary" onClick={() => setOpen(false)}>
                完成
              </button>
            </footer>
          </section>
        </Dialog>
      )}
    </>
  );
}
