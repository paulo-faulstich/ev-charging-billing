import { redirect } from "next/navigation";

import { ImportDropzone } from "@/components/imports/import-dropzone";
import { PageBreadcrumb } from "@/components/shell/page-breadcrumb";
import { getAccessToken } from "@/lib/auth/access-token";

export default async function DataSourcesPage() {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");

  return (
    <div className="data-sources-page">
      <header className="data-sources-header">
        <div>
          <PageBreadcrumb section="Settings" current="Data sources" />
          <h1>Data sources</h1>
          <p>
            Bring in the sessions exported from SEMS+ and follow how they
            enter ChargeOps.
          </p>
        </div>
        <div className="source-state" aria-label="Integration status">
          <span className="source-state-node" aria-hidden="true" />
          <p>
            <span>Current integration</span>
            Assisted import
          </p>
        </div>
      </header>

      <section className="source-adapter" aria-labelledby="sems-source-title">
        <div className="source-adapter-heading">
          <div>
            <p className="utility-label">Connected source</p>
            <h2 id="sems-source-title">SEMS+ CSV</h2>
          </div>
          <p className="adapter-label">File read · never writes to SEMS+</p>
        </div>

        <ImportDropzone accessToken={accessToken} />
      </section>
    </div>
  );
}
