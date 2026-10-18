import React from 'react'
import { FaLinkedin, FaGithub, FaEnvelope, FaFileAlt } from 'react-icons/fa'
import './NotebookOverlay.css'

const RESUME_URL = import.meta.env.BASE_URL + 'Pranav_Turlapati_Resume.pdf'

// Companies with a logo file render it (masked to ink color unless `color`);
// the rest render their name in the notebook's header font.
const logoExperience = [
  {
    company: 'Traba',
    role: 'Software Engineer II',
    logo: 'images/traba-logo.png',
    ratio: 1280 / 353,
  },
  {
    company: 'Merget',
    role: 'Founding Engineer',
    logo: 'images/merget-logo.png',
    ratio: 1,
    color: true,
  },
  {
    company: 'Splunk',
    role: 'SWE Intern',
    logo: 'images/splunk-logo.png',
    ratio: 638 / 193,
  },
  {
    company: 'Cisco',
    role: 'SWE Intern',
    logo: 'images/cisco-logo.png',
    ratio: 1280 / 676,
  },
]

const projects = [
  {
    title: 'AI Decision Model Benchmark (Traba)',
    url: 'https://traba.work/company/engineering/decision-model-bakeoff',
    description:
      'Led a 5-model benchmark on 9K cases. Routing low-confidence cases to a second model cut decision costs 78% at higher accuracy.',
  },
  {
    title: 'Graph-Based Merge Algorithms (Merget)',
    description:
      'Version control for AI-generated code. Graph-based merging catches code conflicts 2x more accurately than Git line diffs.',
  },
  {
    title: 'Live Basketball Analytics (UNC, Duke, NC State)',
    description:
      'CUDA C++ pipeline with PyTorch 3D player tracking, streaming live coaching insights at sub-100ms latency.',
  },
]

const publications = [
  {
    title:
      'Near-infrared spectroscopy-enabled electromechanical systems for fast mapping of biomechanics and subcutaneous diagnosis',
    venue: 'Science Advances, 2024',
    url: 'https://doi.org/10.1126/sciadv.adq9358',
  },
  {
    title: 'Resolution Modeling: WiFi Protocol Classification (first author)',
    venue: 'Research report, UNC, 2026',
    url: 'https://drive.google.com/file/d/1o6vC-gvAdSaddZsyaVWcvzoc-XAXmsgP/view?usp=sharing',
  },
]

function ExternalLink({ href, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="notebook-inline-link">
      {children}
    </a>
  )
}

export default function NotebookOverlay({ visible }) {
  return (
    <div className={`notebook-overlay ${visible ? 'notebook-overlay--visible' : ''}`}>
      <div className="notebook-page">
        <div className="notebook-header-row">
          <img
            className="notebook-profile-image"
            src={import.meta.env.BASE_URL + 'images/60281019-9971-466a-b72e-7d9ba0cb03c3.png'}
            alt="Pranav Turlapati"
          />
          <h1 className="notebook-header notebook-name">
            <span className="notebook-name-first">PRANAV</span>{' '}
            <span className="notebook-name-last">TURLAPATI</span>
          </h1>
        </div>
        <div className="notebook-contact-row">
          <a
            href="https://www.linkedin.com/in/pranavturlapati/"
            target="_blank"
            rel="noopener noreferrer"
            className="notebook-contact-link"
          >
            <FaLinkedin /> LinkedIn
          </a>
          <a
            href="https://github.com/pranavturlapati28"
            target="_blank"
            rel="noopener noreferrer"
            className="notebook-contact-link"
          >
            <FaGithub /> GitHub
          </a>
          <a href="mailto:pranavturlapati02@gmail.com" className="notebook-contact-link">
            <FaEnvelope /> Email
          </a>
          <a href={RESUME_URL} target="_blank" rel="noopener noreferrer" className="notebook-contact-link">
            <FaFileAlt /> Resume
          </a>
        </div>
        <p className="notebook-bio">
          Hey, I'm Pranav! I'm a software engineer at Traba, building AI agents and ML matching
          between workers and factories. Before that I was a founding engineer at Merget and
          interned at Splunk and Cisco. UNC Chapel Hill grad in Computer Science and Statistics.
        </p>

        <h2 className="notebook-header notebook-section-title">Experience</h2>
        <div className="notebook-logo-row">
          {logoExperience.map((job) => (
            <div className="notebook-logo-item" key={job.company}>
              <div className="notebook-logo-slot">
                {!job.logo ? (
                  <span className="notebook-header notebook-logo-text">{job.company}</span>
                ) : job.color ? (
                  <img
                    className="notebook-logo-image"
                    src={import.meta.env.BASE_URL + job.logo}
                    alt={job.company}
                    style={{ aspectRatio: job.ratio, height: '100%' }}
                  />
                ) : (
                  <div
                    className="notebook-logo-mask"
                    role="img"
                    aria-label={job.company}
                    style={{
                      maskImage: `url(${import.meta.env.BASE_URL + job.logo})`,
                      WebkitMaskImage: `url(${import.meta.env.BASE_URL + job.logo})`,
                      aspectRatio: job.ratio,
                      height: '70%',
                    }}
                  />
                )}
              </div>
              <p className="notebook-logo-role">{job.role}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="notebook-spine-gap" />

      <div className="notebook-page">
        <h2 className="notebook-header notebook-section-title">Skills</h2>
        <p className="notebook-body-text">
          Python, TypeScript, Rust, Go, C++, SQL · React, FastAPI, LangChain, PyTorch, CUDA ·
          AWS, GCP, Kafka, PostgreSQL, Docker, Terraform
        </p>

        <h2 className="notebook-header notebook-section-title">Projects</h2>
        {projects.map((item) => (
          <p className="notebook-body-text notebook-experience-item" key={item.title}>
            •{' '}
            <strong>
              {item.url ? <ExternalLink href={item.url}>{item.title}</ExternalLink> : item.title}
            </strong>
            : {item.description}
          </p>
        ))}

        <h2 className="notebook-header notebook-section-title">Publications</h2>
        {publications.map((item) => (
          <p className="notebook-body-text notebook-experience-item" key={item.title}>
            • <ExternalLink href={item.url}>{item.title}</ExternalLink>. <em>{item.venue}</em>
          </p>
        ))}
      </div>
    </div>
  )
}
