export default function TermsPage() {
  return (
    <div className="min-h-screen bg-ground text-ink px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-6">
        <a href="/" className="text-sm text-ink-dim underline underline-offset-2">
          ← Back
        </a>
        <h1 className="text-2xl font-bold">Terms of Service</h1>
        <p className="text-xs text-ink-faint">Last updated: September 2026</p>

        <section className="space-y-2 text-sm text-ink-dim leading-relaxed">
          <h2 className="text-base font-semibold text-ink">The service</h2>
          <p>
            Foodency lets you log meals with photos or text, receive
            AI-generated nutrition estimates, log workouts, and see your
            patterns over time. You must be at least 13 years old to use the service.
          </p>
        </section>

        <section className="space-y-2 text-sm text-ink-dim leading-relaxed">
          <h2 className="text-base font-semibold text-ink">
            AI estimates are approximate
          </h2>
          <p>
            Macro and calorie estimates are produced by AI and can be wrong by
            a meaningful margin. They are for personal tracking only — not
            medical advice, diagnosis, or treatment. Always verify anything
            important with a qualified professional.
          </p>
        </section>

        <section className="space-y-2 text-sm text-ink-dim leading-relaxed">
          <h2 className="text-base font-semibold text-ink">Your content</h2>
          <p>
            You own the photos and notes you upload. By using the service you
            grant us a license to store and process them to operate the app
            (including sending them to our AI providers for analysis). You are
            responsible for having the right to upload anything you share, and
            for not uploading anyone else&apos;s private information.
          </p>
        </section>

        <section className="space-y-2 text-sm text-ink-dim leading-relaxed">
          <h2 className="text-base font-semibold text-ink">Acceptable use</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Don&apos;t abuse the service or attempt to access others&apos; data.</li>
            <li>Don&apos;t use automated tools to scrape or overload the service.</li>
            <li>Don&apos;t share content that is unlawful or infringing.</li>
          </ul>
          <p>
            We may suspend accounts that violate these terms or threaten the
            security of the service.
          </p>
        </section>

        <section className="space-y-2 text-sm text-ink-dim leading-relaxed">
          <h2 className="text-base font-semibold text-ink">
            Subscriptions &amp; payments
          </h2>
          <p>
            Paid plans, if offered, are billed in advance and renew
            automatically until cancelled. Cancel anytime from your account;
            you keep access until the end of the current billing period.
            Refunds are handled case by case.
          </p>
        </section>

        <section className="space-y-2 text-sm text-ink-dim leading-relaxed">
          <h2 className="text-base font-semibold text-ink">Liability</h2>
          <p>
            The service is provided &ldquo;as is&rdquo; without warranties. To
            the maximum extent permitted by law, we are not liable for
            indirect or consequential damages, including decisions made based
            on AI-generated nutrition estimates.
          </p>
        </section>

        <section className="space-y-2 text-sm text-ink-dim leading-relaxed">
          <h2 className="text-base font-semibold text-ink">Changes</h2>
          <p>
            We may update these terms; material changes will be noted here
            with a new &ldquo;last updated&rdquo; date. Continued use of the
            service after changes means you accept them.
          </p>
        </section>
      </div>
    </div>
  )
}
