import type { Speed } from "@shared/tessera";

import type { SpeedBadgeProps } from "./ui/bundle.js";
import { SPEED_TEST_LIMIT_MB, useAuto } from "./auto";
import { plural, t } from "./i18n";
import { latencyLabels } from "./labels";
import { isDirect, methodCount } from "@shared/tessera/methods";
import type { Method } from "@shared/tessera/methods";
import { methodDetail } from "./methods";
import { Modal } from "./Modal";
import type { MethodsModel } from "./useMethods";

const speedLabels = {
  none: t("ts_speed_none"),
  testing: t("ts_speed_testing"),
  unavailable: t("ts_speed_unavailable"),
};
const speedUnit = t("ts_speed_mbps", "").trim();

function mbps(value: number): number {
  return value >= 1 ? Math.round(value) : Math.round(value * 10) / 10;
}

export function speedBadge(speed: Speed | undefined, dead: boolean): SpeedBadgeProps {
  const labels = { labels: speedLabels, unit: speedUnit };
  if (speed?.kind === "testing") {
    return { state: "testing", ...labels };
  }
  if (speed?.kind === "done") {
    return { state: "done", mbps: mbps(speed.mbps), ...labels };
  }
  return { state: speed?.kind === "failed" || dead ? "unavailable" : "none", ...labels };
}

const measure = (tags: string[]) => void window.tessera.auto.measure(tags);

interface MethodsSheetProps {
  model: MethodsModel;
  profileName: string;
  started: boolean;
  connecting: boolean;
  onEnable: () => void;
  onClose: () => void;
}

export function MethodsSheet(props: MethodsSheetProps) {
  const T = window.Tessera;
  const { model, profileName } = props;
  const auto = useAuto();
  const title = t("ts_methods_title");
  const methods = model.methods;
  let sheet;
  if (props.connecting || (props.started && !model.loaded)) {
    sheet = (
      <T.Sheet id="methods" title={title} description={t("ts_profile_named", profileName)}>
        <div className="slate-sheet-loading">
          <T.Icon name="loader-circle" size={32} spin />
        </div>
      </T.Sheet>
    );
  } else if (!props.started) {
    // Групп ядро не даёт, пока выключено, а свою копию конфига не читаем
    sheet = (
      <T.Sheet
        id="methods"
        title={title}
        description={t("ts_methods_off", profileName)}
        footer={
          <T.Button size="lg" block icon="power" onClick={props.onEnable}>
            {t("ts_enable")}
          </T.Button>
        }
      />
    );
  } else if (methods === null) {
    sheet = <T.Sheet id="methods" title={title} description={t("ts_methods_fixed", profileName)} />;
  } else {
    const choose = (action: () => void) => () => {
      props.onClose();
      action();
    };
    const row = (method: Method) => {
      const ping = model.ping(method.tag, method.testedAt, method.delayMs);
      return (
        <T.EndpointRow
          key={`${method.group ?? ""}/${method.tag}`}
          name={method.tag}
          detail={isDirect(method) ? t("ts_method_direct") : methodDetail(method)}
          latency={{ ...ping, labels: latencyLabels }}
          speed={speedBadge(auto.speeds[method.tag], ping.state === "dead")}
          selected={method.selected}
          onClick={method.group === null ? undefined : choose(() => model.select(method))}
          onSpeedTest={() => measure([method.tag])}
        />
      );
    };
    const autoRow = methods.auto;
    const autoServer =
      autoRow === null
        ? null
        : methods.sections.find((section) => section.methods.some((method) => method.tag === autoRow.now))?.server;
    let autoDetail = t("ts_auto_waiting");
    if (autoRow?.now != null) {
      autoDetail = autoServer != null ? t("ts_auto_now_server", autoServer, autoRow.now) : t("ts_auto_now", autoRow.now);
    }
    const all = methods.sections.flatMap((section) => section.methods);
    sheet = (
      <T.Sheet
        id="methods"
        title={title}
        description={t(
          autoRow === null ? "ts_methods_description_no_auto" : "ts_methods_description",
          profileName,
          plural("ts_methods_count", methodCount(methods)),
        )}
        footer={
          <>
            <T.Button
              size="lg"
              block
              variant="outline"
              icon="refresh-cw"
              loading={model.pinging}
              disabled={model.pinging}
              onClick={model.pingAll}
            >
              {t(model.pinging ? "ts_ping_testing" : "ts_ping_all")}
            </T.Button>
            {auto.batch ? (
              <T.Button size="lg" block variant="outline" icon="x" onClick={() => void window.tessera.auto.stopMeasuring()}>
                {t("ts_speed_stop")}
              </T.Button>
            ) : (
              <T.Button
                size="lg"
                block
                variant="outline"
                icon="gauge"
                // direct тоже: его скорость — точка отсчёта, видно, сколько отнимает сервер
                onClick={() =>
                  measure(
                    all
                      .filter((method) => model.ping(method.tag, method.testedAt, method.delayMs).state !== "dead")
                      .map((method) => method.tag),
                  )
                }
              >
                {t("ts_speed_all")}
              </T.Button>
            )}
            <p className="ts-sheet-note t-secondary">{t("ts_speed_note", SPEED_TEST_LIMIT_MB)}</p>
          </>
        }
      >
        <div className="ts-endpoint-list" role="radiogroup" aria-label={title}>
          {autoRow !== null && (
            <T.EndpointRow
              name={t("ts_method_auto")}
              detail={autoDetail}
              latency={{ ...model.ping(autoRow.now, autoRow.testedAt, autoRow.delayMs), compact: true, labels: latencyLabels }}
              selected={autoRow.selected}
              onClick={methods.selector === null ? undefined : choose(model.selectAuto)}
            />
          )}
          {methods.sections.map((section) => {
            const caption = section.server ?? (autoRow !== null ? t("ts_choose_yourself") : null);
            return [
              caption === null ? null : (
                <h3 key={`caption/${section.server ?? ""}`} className="slate-section ts-label t-label">
                  {caption}
                </h3>
              ),
              ...section.methods.map(row),
            ];
          })}
        </div>
      </T.Sheet>
    );
  }
  return <Modal onClose={props.onClose}>{sheet}</Modal>;
}
