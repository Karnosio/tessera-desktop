import { useEffect, useRef, useState } from "react";

import type { DesktopHost, DesktopProfile } from "@dashboard/app/desktop";

import { t } from "./i18n";
import { importFile, importText } from "./importProfile";
import type { ImportError, ImportOutcome } from "./importProfile";
import { Modal } from "./Modal";

export type AddJob = () => Promise<ImportOutcome>;

type Step = { kind: "choose" } | { kind: "link" } | { kind: "busy" } | { kind: "result"; outcome: ImportOutcome };

const FAILURE: Record<ImportError, [string, string]> = {
  empty: ["ts_import_empty_title", "ts_import_empty_hint"],
  unsupported: ["ts_import_unsupported_title", "tsd_unsupported_hint"],
  links: ["tsd_links_later_title", "tsd_links_later_hint"],
  download: ["ts_import_download_title", "ts_import_download_hint"],
  rejected: ["ts_import_rejected_title", "ts_import_rejected_hint"],
};

interface AddProfileSheetProps {
  host: DesktopHost;
  profiles: DesktopProfile[];
  /** Импорт уже начат — ссылкой sing-box:// или файлом, открытым в Slate. */
  job?: AddJob;
  onClose: () => void;
  onEnable: () => void;
}

export function AddProfileSheet(props: AddProfileSheetProps) {
  const T = window.Tessera;
  const { host } = props;
  const [step, setStep] = useState<Step>(props.job === undefined ? { kind: "choose" } : { kind: "busy" });
  const [link, setLink] = useState("");
  const profilesRef = useRef(props.profiles);
  profilesRef.current = props.profiles;

  const run = (job: AddJob) => {
    setStep({ kind: "busy" });
    void job().then((outcome) => setStep({ kind: "result", outcome }));
  };

  const initialJob = useRef(props.job);
  useEffect(() => {
    if (initialJob.current !== undefined) {
      run(initialJob.current);
      initialJob.current = undefined;
    }
  }, []);

  const paste = () =>
    run(async () => importText(host, profilesRef.current, await window.tessera.readClipboardText()));
  const openFile = async () => {
    const file = await host.profiles.pickImportFile();
    if (file !== null) {
      run(() => importFile(host, profilesRef.current, file));
    }
  };
  const addLink = () => {
    if (link.trim() !== "") {
      run(() => importText(host, profilesRef.current, link));
    }
  };

  const close = step.kind === "busy" ? undefined : props.onClose;
  let sheet;
  switch (step.kind) {
    case "choose":
      sheet = (
        <T.Sheet id="import" title={t("ts_add_profile")} description={t("ts_add_description")}>
          <T.ImportTileGrid>
            <T.ImportTile
              icon="clipboard-paste"
              title={t("ts_source_paste")}
              description={t("ts_source_paste_hint")}
              emphasis
              onClick={paste}
            />
            <T.ImportTile
              icon="link"
              title={t("ts_source_link")}
              description={t("ts_source_link_hint")}
              onClick={() => setStep({ kind: "link" })}
            />
            <T.ImportTile
              icon="file-text"
              title={t("ts_source_file")}
              description={t("ts_source_file_hint")}
              onClick={() => void openFile()}
            />
          </T.ImportTileGrid>
        </T.Sheet>
      );
      break;
    case "link":
      sheet = (
        <T.Sheet
          id="link"
          title={t("ts_source_link")}
          description={t("ts_link_description")}
          footer={[
            <T.Button key="add" size="lg" block disabled={link.trim() === ""} onClick={addLink}>
              {t("ts_add")}
            </T.Button>,
            <T.Button key="cancel" size="lg" block variant="ghost" onClick={() => setStep({ kind: "choose" })}>
              {t("ts_cancel")}
            </T.Button>,
          ]}
        >
          <T.Field
            id="link-input"
            label={t("ts_link_label")}
            input={{
              value: link,
              autoFocus: true,
              spellCheck: false,
              onChange: (event) => setLink(event.target.value),
              onKeyDown: (event) => {
                if (event.key === "Enter") {
                  addLink();
                }
              },
            }}
          />
        </T.Sheet>
      );
      break;
    case "busy":
      sheet = (
        <T.Sheet id="busy" title={t("ts_adding_title")} description={t("ts_adding_description")}>
          <T.Icon name="loader-circle" size={32} spin label={t("ts_adding_title")} />
        </T.Sheet>
      );
      break;
    case "result": {
      const outcome = step.outcome;
      if (outcome.kind === "added") {
        sheet = (
          <T.Sheet
            id="result"
            title={t(outcome.existed ? "ts_updated_title" : "ts_added_title")}
            description={outcome.name}
            footer={[
              <T.Button key="enable" size="lg" block icon="power" onClick={props.onEnable}>
                {t("ts_enable")}
              </T.Button>,
              <T.Button key="later" size="lg" block variant="ghost" onClick={props.onClose}>
                {t("ts_later")}
              </T.Button>,
            ]}
          />
        );
      } else {
        const [title, hint] = FAILURE[outcome.error];
        sheet = (
          <T.Sheet
            id="result"
            title={t("ts_add_failed")}
            footer={[
              <T.Button key="retry" size="lg" block onClick={() => setStep({ kind: "choose" })}>
                {t("ts_retry")}
              </T.Button>,
              <T.Button key="close" size="lg" block variant="ghost" onClick={props.onClose}>
                {t("ts_close")}
              </T.Button>,
            ]}
          >
            <T.Callout tone="destructive" title={t(title)}>
              {t(hint)}
            </T.Callout>
            {outcome.detail !== undefined && (
              <p className="slate-detail t-caption">{t("ts_import_detail", outcome.detail)}</p>
            )}
          </T.Sheet>
        );
      }
      break;
    }
  }
  return <Modal onClose={close}>{sheet}</Modal>;
}
