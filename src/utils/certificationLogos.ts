import type { ImageMetadata } from 'astro';
import chaicode from '../assets/certifications/chaicode.png';
import googlecloud from '../assets/certifications/googlecloud.png';
import hackerrank from '../assets/certifications/hackerrank.png';
import namastedev from '../assets/certifications/namastedev.png';
import oracle from '../assets/certifications/oracle.png';
import scaledagile from '../assets/certifications/scaledagile.png';
import udacity from '../assets/certifications/udacity.png';
import udemy from '../assets/certifications/udemy.png';

const certificationLogos: Record<string, ImageMetadata> = {
  'Chai Aur Code': chaicode,
  'Google Cloud Platform (GCP)': googlecloud,
  HackerRank: hackerrank,
  'NamasteDev.com': namastedev,
  Oracle: oracle,
  'Scaled Agile, Inc.': scaledagile,
  Udacity: udacity,
  Udemy: udemy,
};

export function getCertificationLogo(issuer: string): ImageMetadata | undefined {
  return certificationLogos[issuer];
}
