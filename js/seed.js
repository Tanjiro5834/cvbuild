/**
 * @file Seed resume shown on first load.
 */
import { uuid } from './utils.js';
import { DEFAULT_SETTINGS } from './store.js';

export function seedResume() {
  const now = Date.now();
  const id = uuid();
  return {
    id,
    title: 'Alex Carter — Software Engineer',
    updatedAt: now,
    personal: {
      fullName: 'Alex Carter',
      jobTitle: 'Senior Software Engineer',
      email: 'alex.carter@example.com',
      phone: '+1 (555) 123-4567',
      location: 'San Francisco, CA',
      website: 'alexcarter.dev',
      linkedin: 'linkedin.com/in/alexcarter',
      github: 'github.com/alexcarter',
      customLinks: [],
    },
    sections: [
      {
        id: uuid(),
        type: 'profile',
        title: 'Profile',
        hidden: false,
        entries: [
          {
            id: uuid(),
            title: '',
            organization: '',
            location: '',
            start: '',
            end: '',
            present: false,
            hidden: false,
            description:
              '<p>Senior software engineer with 8+ years building scalable web platforms. ' +
              'Specialized in JavaScript, TypeScript, Node.js, and cloud-native architecture. ' +
              'Passionate about developer experience, performance, and clean APIs.</p>',
          },
        ],
      },
      {
        id: uuid(),
        type: 'experience',
        title: 'Experience',
        hidden: false,
        entries: [
          {
            id: uuid(),
            title: 'Senior Software Engineer',
            organization: 'Acme Cloud',
            location: 'San Francisco, CA',
            start: '2021-03',
            end: '',
            present: true,
            hidden: false,
            description:
              '<ul>' +
              '<li>Led migration of a monolith to 20+ microservices, cutting deploy time by 70%.</li>' +
              '<li>Owned the public REST API serving 40M+ monthly requests with 99.99% uptime.</li>' +
              '<li>Mentored 4 engineers and drove adoption of TypeScript across the org.</li>' +
              '</ul>',
          },
          {
            id: uuid(),
            title: 'Software Engineer',
            organization: 'Beta Labs',
            location: 'Remote',
            start: '2018-01',
            end: '2021-02',
            present: false,
            hidden: false,
            description:
              '<ul>' +
              '<li>Built a real-time collaboration engine using WebSockets and CRDTs.</li>' +
              '<li>Reduced page load time by 45% via code-splitting and caching strategy.</li>' +
              '</ul>',
          },
        ],
      },
      {
        id: uuid(),
        type: 'education',
        title: 'Education',
        hidden: false,
        entries: [
          {
            id: uuid(),
            title: 'B.S. Computer Science',
            organization: 'University of California, Berkeley',
            location: 'Berkeley, CA',
            start: '2013-09',
            end: '2017-06',
            present: false,
            hidden: false,
            description: '<p>Graduated with honors. Focus on distributed systems and databases.</p>',
          },
        ],
      },
      {
        id: uuid(),
        type: 'skills',
        title: 'Skills',
        hidden: false,
        entries: [
          {
            id: uuid(),
            title: 'JavaScript, TypeScript, Node.js, Python',
            organization: '',
            location: '',
            start: '',
            end: '',
            present: false,
            hidden: false,
            description: '',
          },
          {
            id: uuid(),
            title: 'React, Vue, Svelte',
            organization: '',
            location: '',
            start: '',
            end: '',
            present: false,
            hidden: false,
            description: '',
          },
          {
            id: uuid(),
            title: 'PostgreSQL, Redis, Kafka, AWS, Docker, Kubernetes',
            organization: '',
            location: '',
            start: '',
            end: '',
            present: false,
            hidden: false,
            description: '',
          },
        ],
      },
      {
        id: uuid(),
        type: 'projects',
        title: 'Projects',
        hidden: false,
        entries: [
          {
            id: uuid(),
            title: 'OpenMetrics Dashboard',
            organization: 'Open Source',
            location: '',
            start: '2022-05',
            end: '',
            present: true,
            hidden: false,
            description:
              '<p>Real-time observability dashboard. 2.1k GitHub stars, used by 30+ companies.</p>',
          },
        ],
      },
    ],
    settings: { ...DEFAULT_SETTINGS },
  };
}