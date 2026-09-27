import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Locale } from "../i18n";
import { t } from "../i18n";
import { IconChevron } from "../icons";

type Props = {
  locale: Locale;
  title: string;
  children: ReactNode;
};

export function SubPageShell({ locale, title, children }: Props) {
  return (
    <section className="panel subpage">
      <div className="subpage-header">
        <Link to="/bench" className="subpage-back">
          <IconChevron size={18} direction={locale === "fa" ? "end" : "start"} />
          <span>{t(locale, "backToBench")}</span>
        </Link>
        <h2>{title}</h2>
      </div>
      <div className="subpage-body">{children}</div>
    </section>
  );
}
