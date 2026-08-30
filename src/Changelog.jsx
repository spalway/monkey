// Changelog: a list of articles, and one article.
//
// Both live in a single container rather than the per-section shells the docs
// use — an article is one piece of writing, and breaking it into containers
// would imply divisions the writing does not have.

import { ArrowLeft, TriangleAlert } from 'lucide-react';
import { ARTICLES, articleBySlug } from './articles.js';
import { IS_MAINNET } from './cluster.js';

/// Every article's blocks are plain data; this is the only place that knows how
/// each kind renders. See articles.js for the shapes.
function Block({ block }) {
  if (block.h) return <h3 className="article-h">{block.h}</h3>;
  if (block.p) return <p>{block.p}</p>;
  if (block.code) return <pre className="doc-code">{block.code}</pre>;
  if (block.list) {
    return (
      <ul className="doc-list">
        {block.list.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.note) {
    return (
      <div className="notice">
        <TriangleAlert size={16} strokeWidth={2} aria-hidden />
        <span>{block.note}</span>
      </div>
    );
  }
  return null;
}

/// The thumbnail, bleeding past the container's padding on three sides.
///
/// The overhang is the point: the artwork carries its own dark ground, and
/// letting it run to the container's edge means no seam where the two nearly
/// but not exactly match. A new thumbnail never has to be colour-matched.
function Thumb({ article, className = '' }) {
  return (
    <div className={`article-thumb ${className}`}>
      <img
        src={article.thumb}
        alt={article.title}
        width={1500}
        height={600}
        loading="lazy"
      />
    </div>
  );
}

function ArticleView({ article }) {
  const accent = article.accent ?? 'var(--accent)';

  return (
    <section>
      <div className="shell article">
        <Thumb article={article} />

        <a className="back" href="#/changelog">
          <ArrowLeft size={13} strokeWidth={2.2} aria-hidden />
          Back to changelogs
        </a>

        <div className="article-head">
          <span className="article-n" style={{ color: accent }}>
            #{article.number}
          </span>
          <span className="article-ver" style={{ '--accent-a': accent }}>
            Changelog {article.version}
          </span>
        </div>

        <h1 className="article-title" style={{ color: accent }}>
          {article.title}
        </h1>

        <div className="doc article-body">
          {/* Blocks flagged devnetOnly describe the test network and would be
              false on a live site, so they are dropped rather than reworded. */}
          {article.body
            .filter((block) => !(IS_MAINNET && block.devnetOnly))
            .map((block, i) => (
              <Block key={i} block={block} />
            ))}
        </div>
      </div>
    </section>
  );
}

function ListView() {
  return (
    <>
      <section className="hero">
        <h1>Changelog.</h1>
        <p className="lede">What has been built, newest first.</p>
        <p>
          {IS_MAINNET
            ? 'A record of what has shipped, and what each release changed.'
            : 'Primates is on devnet. Anything below can change, and the program has been redeployed more than once — treat these as a record of what exists rather than a release history.'}
        </p>
      </section>

      <section>
        <div className="shell">
          <div className="label">
            <span>Articles</span>
            <span>
              {ARTICLES.length} {ARTICLES.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className="article-list">
            {ARTICLES.map((article) => {
              const accent = article.accent ?? 'var(--accent)';
              return (
                <a
                  className="article-card"
                  key={article.slug}
                  href={`#/changelog/${article.slug}`}
                  style={{ '--accent-a': accent }}
                >
                  <Thumb article={article} className="in-card" />
                  <div className="article-card-body">
                    <div className="article-head">
                      <span className="article-n" style={{ color: accent }}>
                        #{article.number}
                      </span>
                      <span className="article-ver">Changelog {article.version}</span>
                    </div>
                    <h2 style={{ color: accent }}>{article.title}</h2>
                    <p>{article.summary}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}

export default function Changelog({ slug }) {
  const article = slug ? articleBySlug(slug) : null;

  // An unknown slug falls back to the list rather than to an error page: the
  // only way to reach one is a stale or mistyped link, and the list is what the
  // reader wanted anyway.
  if (slug && !article) return <ListView />;

  return article ? <ArticleView article={article} /> : <ListView />;
}
