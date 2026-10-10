import type { PolicyId } from '../model/contracts';

export const equations = {
  objective: String.raw`J_t(S)=\sum_{r\in\mathrm{WAIT}}\!\left[\max(0,\hat p_r-t)+\frac{\zeta}{100}\max(0,\hat p_r-a_r-w_0)^2\right]+\alpha\sum_{r\in\mathrm{WAIT}\cup\mathrm{ONBOARD}}\hat R_r`,
  residual: String.raw`\hat R_r=\begin{cases}\max(0,\hat d_r-\hat p_r)&r\in\mathrm{WAIT}\\\max(0,\hat d_r-t)&r\in\mathrm{ONBOARD}\end{cases}`,
  travel: String.raw`\delta=h|f-g|,\qquad T_{\mathrm{moto}}(\delta)=\begin{cases}0&\delta=0\\2\sqrt{\delta/a}&0<\delta\le v^2/a\\\delta/v+v/a&\delta>v^2/a\end{cases}`,
  stop: String.raw`T_{\mathrm{stop}}=b+u\,(n_{\mathrm{saliti}}+n_{\mathrm{scesi}})`,
  capacity: String.raw`c_e^{\mathrm{real}}=\min\!\left(C_e,\left\lfloor\frac{Q_e}{80}\right\rfloor\right),\qquad c_e^{\mathrm{plan}}=\min\!\left(C_e,\left\lfloor\frac{0.96\,Q_e}{80}\right\rfloor\right)`,
  constraints: String.raw`80(n_e+1)\le Q_e,\quad n_e+1\le C_e;\qquad80\hat n_e\le0.96Q_e,\quad\hat n_e\le C_e`,
  dispatch: String.raw`(e^*,i^*,j^*)\in\operatorname*{arg\,min}_{e,\,i<j\;\mathrm{fattibili}}\big[J_t(S\oplus(e,i,j,r))-J_t(S)\big]`,
  fifo: String.raw`\mathrm{score}_{\mathrm{fifo}}=\mathrm{ETA}_{\mathrm{nuovo}}+0.28\,\mathrm{ride}_{\mathrm{nuovo}}+0.32\sum_{r\,\mathrm{esistenti}}\max(0,\Delta\mathrm{ETA}_{\mathrm{pickup},r})`,
  population: String.raw`N_f=\sum_{o:f_o=f}N_o,\qquad\mathbb E[\#R]=\sum_oN_o(2+2p_o+p_{\mathrm{internal}})`,
  demandSource: String.raw`\lambda_{od}(t)=\lambda_{\mathrm{apertura}}(t)+\lambda_{\mathrm{pranzo}}(t)+\lambda_{\mathrm{chiusura}}(t)+\lambda_{\mathrm{altro}}(t),\qquad o\ne d`,
  learned: String.raw`\hat\mu_o=\frac{n_o\bar t_o+\kappa h_o}{n_o+\kappa},\quad\hat p_o=\frac{n_o+\alpha_{\mathrm{prior}}p_o}{D N_o+\alpha_{\mathrm{prior}}},\quad\hat\sigma_o^2=\frac{n_o s_o^2+\kappa\sigma_0^2}{n_o+\kappa}`,
  density: String.raw`\hat\lambda_o(t)=N_o\hat p_o\,\phi_{\hat\sigma_o}(t-\hat\mu_o)`,
  forecast: String.raw`\hat D_o(t)=N_o\hat p_o\!\left[\Phi\!\left(\frac{t+L+H-\hat\mu_o}{\hat\sigma_o}\right)-\Phi\!\left(\frac{t+L-\hat\mu_o}{\hat\sigma_o}\right)\right]`,
  coverage: String.raw`q_e=0.82\,c_e^{\mathrm{plan}},\qquad B_f=\sum_{e\in I(t)}q_e x_{ef},\qquad k_f=\sum_{e\in I(t)}x_{ef}`,
  gain: String.raw`G_f(B_f)=30\,\frac{D_f^{1.25}-\max(0,D_f-B_f)^{1.25}}{\max(1,D_f^{0.25})}`,
  allocation: String.raw`\max_x\left[\sum_fG_f(B_f)-0.10\sum_{e,f}T_{ef}x_{ef}-0.10\sum_{e,f}|f_e-f|x_{ef}\right]`,
  allocationConstraints: String.raw`x_{ef}\in\{0,1\},\quad\sum_f x_{ef}\le1,\quad\sum_{e,f}x_{ef}\le\max(0,|I(t)|-1),\quad k_f\le3`,
  marginal: String.raw`\Delta_{ef}=G_f(B_f+q_e)-G_f(B_f)-0.10T_{ef}-0.10|f_e-f|`,
  metrics: String.raw`W_r=p_r-a_r,\qquad R_r=d_r-p_r,\qquad T_r=d_r-a_r=W_r+R_r`,
  nnls: String.raw`\lambda(t)\approx\beta_0+\sum_{j=1}^{K}\beta_j\,\phi_{\sigma_j}(t-\mu_j),\qquad\hat\beta=\operatorname*{arg\,min}_{\beta\ge0}\|A\beta-y\|_2^2`,
};

export const POLICY_NAMES:Record<PolicyId,string> = {
  fifo:'Solo su chiamata', optimal:'Chiamate e orari', adaptive:'Chiamate e previsione',
};

export const policies = [
  { number:'01', name:POLICY_NAMES.fifo, id:'fifo', headline:'Aspettare la chiamata.', summary:'Dopo il servizio, la cabina rimane all’ultima fermata. Si muove quando arriva una chiamata.', text:'Quando arriva una chiamata, confronta le cabine valutando il tempo per raggiungere la persona, il viaggio e i ritardi agli altri passeggeri.', detail:'La cabina libera resta all’ultima fermata. È il riferimento del confronto: non significa servire sempre in ordine di arrivo, né rappresenta ogni ascensore commerciale.' },
  { number:'02', name:POLICY_NAMES.optimal, id:'optimal', headline:'Prepararsi in base all’orario.', summary:'Valuta le attese di tutte le persone coinvolte. Quando è libera, la cabina si prepara seguendo orari e zone prestabiliti.', text:'Per ogni chiamata confronta le sequenze di fermate possibili e sceglie quella che aggiunge meno attesa e viaggio complessivi, rispettando posti e portata.', detail:'Le cabine libere si spostano verso piani stabiliti dalle fasce orarie e dalle zone dell’edificio. La scelta riguarda la chiamata corrente: non garantisce il miglior risultato dell’intera giornata.' },
  { number:'03', name:POLICY_NAMES.adaptive, id:'adaptive', headline:'Prepararsi dove serve.', summary:'Assegna le chiamate come “Chiamate e orari”. Posiziona le cabine libere usando una previsione delle uscite e dei ritorni dal pranzo.', text:'Sceglie le fermate con lo stesso criterio di “Chiamate e orari”. Cambia dove aspettano le cabine libere: usa le abitudini degli uffici stimate su giornate simulate separate per anticipare uscite e ritorni dal pranzo.', detail:'Sposta le cabine soltanto quando la previsione giustifica il movimento, rispettando le capienze e lasciando una cabina disponibile di riserva. Non apprende durante il confronto e non garantisce attese inferiori in ogni scenario.' },
] as const;
