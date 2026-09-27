import type { Locale } from "../i18n";
import { t } from "../i18n";
import { SubPageShell } from "./SubPageShell";
import {
  PhoneSettingsPanel,
  type PhoneDetectState,
  type PhoneSettingCategory,
  type PhoneSettingIssue,
} from "./PhoneSettingsPanel";

type Props = {
  locale: Locale;
  phoneCategories: PhoneSettingCategory[];
  phoneIssues: PhoneSettingIssue[];
  phoneCategory: string;
  phoneDetectMap: Record<string, PhoneDetectState>;
  busy: boolean;
  onPhoneCategory: (id: string) => void;
  onPhoneDetect: (issueId: string) => void;
  onPhoneFix: (issueId: string) => void;
};

export function PhoneSettingsPage(props: Props) {
  return (
    <SubPageShell locale={props.locale} title={t(props.locale, "phoneSettingsSection")}>
      <PhoneSettingsPanel
        locale={props.locale}
        open
        alwaysOpen
        onOpen={() => undefined}
        categories={props.phoneCategories}
        issues={props.phoneIssues}
        activeCategory={props.phoneCategory}
        onCategory={props.onPhoneCategory}
        detectMap={props.phoneDetectMap}
        busy={props.busy}
        onDetect={props.onPhoneDetect}
        onFix={props.onPhoneFix}
      />
    </SubPageShell>
  );
}
