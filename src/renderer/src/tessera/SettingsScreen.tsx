import { useEffect, useMemo, useState } from "react";

import type { DesktopHost } from "@dashboard/app/desktop";

import { SPEED_TEST_LIMIT_MB, useAuto } from "./auto";
import { t } from "./i18n";
import gpl3 from "./licenses/license_gpl3.txt?raw";
import notice from "./licenses/license_notice.txt?raw";
import oflJetBrainsMono from "./licenses/license_ofl_jetbrains_mono.txt?raw";
import oflManrope from "./licenses/license_ofl_manrope.txt?raw";
import { Modal } from "./Modal";

const SOURCE_URL = "https://github.com/Karnosio/tessera-desktop";

export type License = "app" | "manrope" | "jetbrains-mono";

const LICENSES: Record<License, { title: () => string; texts: string[] }> = {
  app: { title: () => t("ts_license_app"), texts: [notice, gpl3] },
  manrope: { title: () => t("ts_license_font", "Manrope"), texts: [oflManrope] },
  "jetbrains-mono": { title: () => t("ts_license_font", "JetBrains Mono"), texts: [oflJetBrainsMono] },
};

export function SettingsScreen(props: { host: DesktopHost; onBack: () => void; onAbout: () => void }) {
  const T = window.Tessera;
  const { host } = props;
  const [openAtLogin, setOpenAtLogin] = useState<boolean | null>(null);
  const [criterionOpen, setCriterionOpen] = useState(false);
  const auto = useAuto();

  useEffect(() => {
    void host.settings.get().then((settings) => setOpenAtLogin(settings.openAtLogin));
  }, [host]);

  const toggleOpenAtLogin = (value: boolean) => {
    setOpenAtLogin(value);
    host.settings.setOpenAtLogin(value).catch(() => setOpenAtLogin(!value));
  };

  return (
    <T.Screen
      ground="background"
      className="slate-screen"
      top={<T.TopBar title={t("ts_settings")} onBack={props.onBack} backLabel={t("ts_back")} />}
    >
      <div className="slate-settings">
        <T.ListGroup title={t("ts_group_auto")}>
          <T.ListRow
            icon="gauge"
            title={t("ts_auto_criterion")}
            value={t(auto.criterion === "speed" ? "ts_auto_by_speed_short" : "ts_auto_by_ping")}
            chevron
            onClick={() => setCriterionOpen(true)}
          />
        </T.ListGroup>
        <T.ListGroup title={t("ts_group_work")}>
          <T.ListRow
            icon="power"
            title={t("tsd_open_at_login")}
            description={t("tsd_open_at_login_description")}
            switch={{ checked: openAtLogin ?? false, disabled: openAtLogin === null, onChange: toggleOpenAtLogin }}
          />
        </T.ListGroup>
        <T.ListGroup title={t("ts_group_more")}>
          <T.ListRow
            icon="settings"
            title={t("ts_advanced")}
            description={t("ts_advanced_description")}
            chevron
            onClick={() => void window.tessera.openAdvanced()}
          />
          <T.ListRow icon="info" title={t("ts_about")} chevron onClick={props.onAbout} />
        </T.ListGroup>
      </div>
      {criterionOpen && (
        <Modal onClose={() => setCriterionOpen(false)}>
          <T.Sheet id="auto" title={t("ts_auto_criterion")} description={t("ts_auto_criterion_description")}>
            <div className="ts-endpoint-list" role="radiogroup" aria-label={t("ts_auto_criterion")}>
              {(["ping", "speed"] as const).map((criterion) => (
                <T.OptionRow
                  key={criterion}
                  title={t(criterion === "speed" ? "ts_auto_by_speed" : "ts_auto_by_ping")}
                  description={
                    criterion === "speed"
                      ? t("ts_auto_by_speed_description", SPEED_TEST_LIMIT_MB)
                      : t("ts_auto_by_ping_description")
                  }
                  selected={auto.criterion === criterion}
                  onClick={() => {
                    setCriterionOpen(false);
                    void window.tessera.auto.setCriterion(criterion);
                  }}
                />
              ))}
            </div>
          </T.Sheet>
        </Modal>
      )}
    </T.Screen>
  );
}

export function AboutScreen(props: { host: DesktopHost; onBack: () => void; onLicense: (license: License) => void }) {
  const T = window.Tessera;
  const { host } = props;
  const [version, setVersion] = useState("");
  const [coreVersion, setCoreVersion] = useState("");

  useEffect(() => {
    void host.appVersion().then(setVersion);
    void host.core
      .info()
      .then((info) => setCoreVersion(info.version))
      .catch(() => {});
  }, [host]);

  return (
    <T.Screen
      ground="background"
      className="slate-screen"
      top={<T.TopBar title={t("ts_about")} onBack={props.onBack} backLabel={t("ts_back")} />}
    >
      <div className="slate-settings">
        <T.ListGroup>
          <T.ListRow title="Slate" value={version} />
          <T.ListRow title={t("ts_core_version")} value={coreVersion} />
          <T.ListRow
            title={t("ts_source_code")}
            description={SOURCE_URL.replace("https://", "")}
            onClick={() => window.open(SOURCE_URL)}
          />
        </T.ListGroup>
        <T.ListGroup title={t("ts_licenses")}>
          <T.ListRow
            title={t("ts_license_app")}
            description={t("ts_license_app_description")}
            chevron
            onClick={() => props.onLicense("app")}
          />
          <T.ListRow title={t("ts_license_font", "Manrope")} chevron onClick={() => props.onLicense("manrope")} />
          <T.ListRow
            title={t("ts_license_font", "JetBrains Mono")}
            chevron
            onClick={() => props.onLicense("jetbrains-mono")}
          />
        </T.ListGroup>
      </div>
    </T.Screen>
  );
}

// Текст лицензии без изменений, только строки внутри абзаца сведены в одну: в узком окне переносы по 72 знака рвут текст
export function LicenseScreen(props: { license: License; onBack: () => void }) {
  const T = window.Tessera;
  const license = LICENSES[props.license];
  const paragraphs = useMemo(
    () =>
      license.texts
        .flatMap((text) => text.replaceAll("\r\n", "\n").split("\n\n"))
        .map((paragraph) =>
          paragraph
            .split("\n")
            .map((line) => line.trim())
            .join(" ")
            .trim(),
        )
        .filter((paragraph) => paragraph !== ""),
    [license],
  );
  return (
    <T.Screen
      ground="background"
      className="slate-screen"
      top={<T.TopBar title={license.title()} onBack={props.onBack} backLabel={t("ts_back")} />}
    >
      <div className="slate-license">
        {paragraphs.map((paragraph, index) => (
          <p key={index} className="t-secondary">
            {paragraph}
          </p>
        ))}
      </div>
    </T.Screen>
  );
}
