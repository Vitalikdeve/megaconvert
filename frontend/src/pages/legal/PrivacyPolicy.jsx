import React from 'react';
import LegalLayout from '../../components/layout/LegalLayout.jsx';

export default function PrivacyPolicy() {
  return (
    <LegalLayout
      title="Privacy Policy"
      subtitle="Draft placeholder text. Final approved legal wording will be inserted in a later phase."
    >
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed non massa non turpis luctus posuere. Nunc luctus
        ipsum vel massa pharetra, vitae malesuada lectus feugiat. Donec in metus ut sem vulputate viverra at vel
        velit.
      </p>

      <h2>E2EE and Zero-Access Model</h2>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas posuere, nisl at convallis eleifend, risus
        leo iaculis mauris, non sollicitudin lacus ante et neque. Vestibulum ante ipsum primis in faucibus orci luctus
        et ultrices posuere cubilia curae.
      </p>
      <ul>
        <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
        <li>Phasellus interdum nisi non dui hendrerit, id pulvinar sapien aliquet.</li>
        <li>Nullam aliquet lacus ac augue tincidunt, eu placerat turpis vulputate.</li>
      </ul>

      <h2>Data Categories and Processing</h2>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. In sodales lacus ut dignissim dictum. Vivamus et
        turpis facilisis, elementum justo ac, consequat justo. Pellentesque habitant morbi tristique senectus et netus
        et malesuada fames ac turpis egestas.
      </p>
      <ul>
        <li>Morbi porttitor sem in mauris feugiat, quis fermentum justo placerat.</li>
        <li>Aliquam congue nibh sit amet magna tempor, sed efficitur arcu vestibulum.</li>
        <li>Suspendisse dictum ipsum non ligula tincidunt, a posuere lectus mollis.</li>
      </ul>

      <h2>User Rights and Contacts</h2>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer pretium velit a purus luctus posuere.
        Curabitur bibendum, tortor sed efficitur vestibulum, augue neque luctus velit, nec vulputate justo diam vitae
        lectus. Contact: <a href="mailto:privacy@megaconvert.com">privacy@megaconvert.com</a>.
      </p>
    </LegalLayout>
  );
}
