import React from 'react';
import LegalLayout from '../../components/layout/LegalLayout.jsx';

export default function TermsOfService() {
  return (
    <LegalLayout
      title="Terms of Service"
      subtitle="Draft placeholder text for AUP, arbitration, and mesh network limitations."
    >
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur volutpat, neque non maximus gravida, tortor
        lorem ullamcorper felis, non fringilla nibh lorem non velit. Cras volutpat lacus non lorem egestas, in
        scelerisque purus efficitur.
      </p>

      <h2>Acceptable Use Policy (AUP)</h2>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec volutpat velit sit amet risus pulvinar, sed
        volutpat neque mattis. Fusce tincidunt luctus odio, ac luctus magna dictum ac.
      </p>
      <ul>
        <li>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</li>
        <li>Sed tincidunt justo in quam fermentum, at egestas arcu semper.</li>
        <li>Integer consequat turpis quis augue ultricies, at pretium tortor semper.</li>
      </ul>

      <h2>Arbitration and Dispute Resolution</h2>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam vestibulum libero non ligula sodales, in
        convallis nisl tincidunt. Vivamus cursus lectus sed massa tincidunt, id aliquet massa blandit.
      </p>
      <ul>
        <li>Mauris non lectus sed ipsum feugiat semper non et lectus.</li>
        <li>Etiam viverra sem in consequat finibus.</li>
        <li>Nunc dictum nisi id iaculis imperdiet.</li>
      </ul>

      <h2>Mesh and Connectivity Disclaimer</h2>
      <p>
        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque lacinia, massa ac tristique tincidunt, justo
        lacus vehicula augue, ut volutpat erat erat et turpis. Ut semper sapien vel sem aliquet, id cursus nibh
        lacinia.
      </p>
    </LegalLayout>
  );
}
