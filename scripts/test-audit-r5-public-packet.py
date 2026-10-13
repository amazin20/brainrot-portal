"""Read-only R5 transport guards. No network, replay, deployment or PUBLIC acceptance.

Provider controls are the genuine complete log and Git API response from the
original run. Tiny ZIP/selection fixtures test transport only, never site proof.
"""
import base64
import copy
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import stat
import tempfile
import unittest
from unittest import mock
import warnings
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
os.chdir(ROOT)
spec = importlib.util.spec_from_file_location('r5_packet_audit', ROOT / 'scripts/audit-r5-public-packet.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)
CONFIG = json.loads((ROOT / 'tools/r5-public-packet-audit.json').read_text())
HELPER = audit.load_helper(CONFIG)
# Lossless embedded controls make runner tests independent of private local paths.
PUBLIC_LOG_B85 = 'c-rK>>z3ozktX_k&MV9x9M5>FWDCrFzvQ%gxg?dXT4P<7RBEr0+?@tVFcTJ&pn1uvRCmvdoge3s&MTaV4S)nl1TJJ*-K*O@V`pZ?jxP{9cI?=<i2v{Z`F{lyCgv>W@-1_>jNdXdk=7aM-1pI^`^_d@?V`<owMsY9Q@Yt^`RX=$AtqAV348H>wKjL0F{8ha{@Z{1;eM0v*Z=rU(f-Y2a-T+DZ}O)M`J@}Nxp(~g=<|HLOXtz2`Qv)OOQTo!APUujYv;d@{-F{OsXz!Z(cVx^gmChE<o=lLZljr;bFq+;%f#!2(A<cGYbK|u5o#f)%y7GKGe&WfjDY~3?6c)O`YhR{g$zi@#9JY5g}W8@d$P5cpzc5Bn;%h4pWR0PtP>^;Tlm<kB#o7wEn;t^iRX+>Q<g9@OXR;&?382hY2T#xK^gDT?QXx76tM;z(8Ds{&u^nwKkYXuN$Hgcy_&A(MaNQ<R-$eX{r}ZE-6Xqgbsv5E41M}YHFJ!c@1yUg`_*nw(pYA{kA#{qHPIB27gBv6{o(DmB!P8o(5DC{v1?jQnQY>bc_6us_Tg*dATZT{8^h17S52g_6HYY}UV_EFS<ROFISi9;^TqC6vH`@0-EO_Ty}7y1b`SgMWR^ePB(oiG-rf`gInGeD?ag$VPj3qOgu1Dt-jo!@Ki+&-(l8Z&lP2@Wbn-Z-#8TFn^5ek*mua#cBhsd5vAx+P_Xp8_DSlTMjzZSfs$qR<g{qt9@87)r{JT%?-hTDJUVj;Voo*hpEq26~YVJAq@2lbiZlevTge3K7t)J$r9XPLUTFI0LEBGv3FZ1Weesazwe8d;&E}190q=z;Pny*pC;14$0j<Q`TgffGaD3#`*g>Tc@Cf!Bbe7~7NN0&;W+Gyp#gM6CI9@6MBpQk;-7=iP^*PC<=h8?{F_qbT*@1l9ONoTu!^W54_38|gZ$9Bnb3Cj8F9$L+#q(eX@oC=ol`*at)RY4rh^LMLdp3I|cwa8mrTI)4<J?OoPv}_6@<l78ojb2n14<A4KG2icg`=nk(FTef#)h*|9n5bAHg|V8=wUdrnmr65RNH=vlSr}`D5g)aJI|qit)iCgFy4$bg73ls5ue_HsO|)=smZY=9871aCbt+j*=W=1^27DS5tR3E4DYan3;44+e$!3==;IBt10LhtzGn24sGE;i$txCWGoHsMi=F|B?&m8lzO$s})9HvJu2lha|T4eVy)5U8X62E=Yr3~K5xwX>F{gfrC6`*{cOcnI5(KGnf8Te-qtxX08zR56{P6uitjPpu>gA&Yq>R}dC$xNqnXBJ{=l5}oUwn#xMdMamZ#$?(ifS+)!nP+C00Q)u35oyAWUbwl@Q<GXf)!_G)PraBbP{2Y#ykHjz6YVlcD>yGBtMxL4!0j*jG+HH(FxX*+%NEa33V|g2_xo%cM%navmwp^2>ovHXXa}BQy-A<4^j(y|@9Fz=hS6WP+v3OUlV!BtPnX#&$~W_Dl>no^fbUtQ&#lrZa0LQG!}<gswTwinwFa;Jee@3Ity_{rYVcAKD0y)kP3KlY0LztfayCnnSz;7KBM?qc=QC$hF-sPSO%sxt#i0~Mi*z@8h`~qzIARpFVHoH|(HcXC?JfpiJcpShOP1j07x3RH*%AhAA#`OKw^8z#{FJQ(yP0m1Y_-XE@jBn^k|o8%hq)q(cKMGfge|}N)vrj(Fjqv;cKZ--cbjYm5%+GhC#Cb??kf8IHr?Dt5IGRU9$ZsU!VE%(RVQE1Bnw@&g^6LC##R5v;1JTdn2<V~8)1%}10hO}mOXQ>z<bEw#p_Leze%^-ZVZ^#JvLb``j~TArv>KwDTuybro9b}w4p(|i?_)ljSmxPk4U}{2_{nbjQuLKU2hKR>wy)aGt<=*HG;epKIrw6@8103v%62f`r?Z>Z*L>H5GjN%!p;{kB{Eo3I;U0QVZH+|Ez_x&)*9wXu2uyj`u3~uzWMa^-8ZlQ;mzwm-hK1kmv^|r!UzV|jb1THF;GnFb_TEBzJ2}0*B~P&+k%_KwqJku$sgW)diTkzZ(kq7;A)^v%6K@-PlwzM$rm)z8=v`!2EWHK5dZdhHA5$R@i^DP%h-CjTt-K~&vw<802LV(&9xTA;uc#SY%a>S(Tkgh{4p)p05=%mohjnv_ZJk3l?+gRfThJF%p3oBv)^uRrr8RY9F>&qO^pSo3;kRpj0A9;w0m7`IkQ|0=>rHDBnQrK(?<|K*<{P-C<lm5Hb+f-{?!++f77CYJ6IvFZx&qm`NGWNRB96|pZIv1Xd8Q>6Tu)vggD_vG))&dgt(7M(Cs}e=wO1xFDXKtX!ek-AiyBxlZ<KT*;n&<(?n{Ww9CVkyemK9IWRAAN{j?%<_LX4XJ8)iAW+m)Czagdxa1zk$$TF8PLAS?wiiMY2a%q}#TG;;`0e<OvvQRd<%<tzm=@fStS>g-tTLRRv!5#1quMDB)^SH^EdzERN-Lfr*!R&xwgR92-4-Q$@tACP>E;FYGD?eqTm&{3e#we&iGcfR_ArUwKERlsr;B92+?9U}4JbG(aXDDPy~|*kR+uXq-7g+N;9meja5HkkfO{St0{0g9P9z7DScL@KA*MjqxH5#!eue-tT0y{h=!z`eejL4f$bf5*Yr9{saq0$G_`-L|W(B(Wm;mG8E)SnI1B_de&>p0sNO*`?3SR%EZJ3}ECZ*0lDHQQ{sENO)I10u^4=BvotOETKcx@xJy?h1!Yxa<DQ}p*>6|la*p>nVg=$04QZ7)8KUO+st`tb#Z@DzxW7)%u)FXpf&SmtZo_IQDI1gnO95zi*L2VC~>ELnlagKokPoJUVtQglc;GRW_N<*DxZWNi;5g`P{u__0TwM(94?#+w80&$4YYU8aTHpxG_%li~6r`bDjGAwr9i`BOGan_c^57=0LQ{el8>QaIceEWHe<30(K?ISiwkhX?B)?KN&NUb!KFg%#MJ?Otk=KIX89Lx&E7>mI<{b_7R-C9p&=UJaRs!G9`iYA(3wgRsG~-{p_V4px)*$!3aOG0T_BG%ODZW)A+J>z%`v`3xuG*#r@Y^_yYbc{Ah_fYMuCpGCecW3c@izu|#s1$}~>QiEiTV>I(P403QTuteCT_v!mJ&~4H`O<*PVX~BiSGO%tT1F*vq1*eWQ!EpubXM2dYo>EvHMe(d*|Gh%JIF;%}^gsSb)XD+YE6@&IeQ4BZ^DqAr-L{V;qm&MD>vhUQGyl^h82g`Y|8(=G(%%1s1`oeZ()YVf@&KN+^)L*@@FJYg{9Jk+A@CrTBd1BrU~e+&=m#`m@2~BLf69t;k~fP#p%a6E@|J*u*pOXl$E^Z|rGM%4Nbw5)I4Q^``%SygGv0x4YM?HLXg+%N-P_N<`sU5|uin1->dV_`nry)rQX4sz2?!C{0EcCn#NCFP!}=X=nG6hhEmMrs-w8IohS?zpS3M~gY`+o3o(z2a8YZ+9HJz6|lg7sll4|z(^(I|xZ%_x@n_u0AUy3f+-V_u!zba{Plcypnem)nOyNPmM3EY1E-6ns$ZgMNQ=`dwQzlwgqz_bWP{xJ&wNmd!oS@|k{Qc>+c@!yx9cT=aJ0F0810@&<8%>3Op-NbSpr>m!Ildmu~i=QN~<8%^I$c|&E)sDQMLxi#3|Mb%`J?xjkcW4&RVB~BPSOafUn7Y%rI1%IxamKf%Wb_`lS;oo8uac3El+iP8arM+8<0j7^g~ZLx?GCLj>~q3Tvt7koo=G;K4JD7%n$p=US?^%gR&eL>V!vF*b1&0$Hmym}K}BIIg8@`K=0k#FgJ~|aMH)Zpvte>ZL7`|PDT|$D;ozLX3IhDib`S2oI18=gP&5>tv0=lt8_&crr-9eP(bfTZPDY_xX9SIkW`I_Z!fN6EIWD>TCMH2dA;R)@IAU=ql+K4ipHUMsa3+<aWmq#2<I-rmPC&os7IZ>EfpDo@7l@40_b7bPL6yw*6p0|CP=%45s0tiVI3k}1vs~^-V49M`R^0n;?D8YPx2(1c7=tu6MM+`f=65Id^k^P^A5N1}=*BqPgWl84=M)r{wYp2o>1I*QDu=H~Qm?!;`UJF#ltOpTvmW#!$k_%5yUQNa7SvM`3e7w32cki=wkc1(X}lv5fhd?~Y%pS>vrfE%ghCUH>yc<f)Otos;VUl0Sp0#CKBJ~&(3ZP_GL$1^rmQro1HC~<;TqTb?IoX%;d4SkVRcWlW$Xiy^{L}&BGPmeZm|VE0Jrk95s6q)P*C3MeyDI<A8(h*u03QT$p}=5v2ri!M#PJ3`Pep-Hz_C-!Mfswibp!do4`c~`;^VoydCO{j6#)~b)bf(@pON`$ljk#lP7UfH!X#)tn&l#w|!As7bS(Qz2bwgo0Fy^kx%F-T+58V0M`%1CBN4R*D>w9W9%4j#@ki0-ah0f&Y_)#!h`?wU3mP=6P=>*fj&qvqdK7^wBK#A^eI`kdc8IZ3JbzO-G|lvS#s!S3FAo%&FAU+o9q#m`cE)7tdP|#-^^ph>Tom_g{hb`otR5JQj0hFewS|Jzb2*G33Ucb5mLyS3*C>rjU@;1D{i(O_LPdkG)jq1%zT}$;%YByk<a$qc%CKqt9-l5X4{ItK9gc#J4!Bai`}{?FSJ8!y_#opoWx3&=1dftltPE4j_W}WyA8#S$@mGcUuLu9G+yf=CD1i<c(I`a{VCh-!!Vtv+w6XIP-Z+$7I^38OoqM&lq7gWKuB`z%$r^Q4*GbLuIA|mqMIW)NkidDFR1aJqQ76w(i>PztrPeNU{J7&+1#XzPg9&uW2v<;$~k6iT;CtOs68d8ro-9}9G%XXnH#GYi79ZbVX!<IDkt5ZlG8e7$IEFI=d(1KJC`m3j$+(#&WFlLx2NRv_7XW^q$oC9EO;`L1&)CpWP|0T+Y@pcuKfk}nJS$~VZp)M!oIYGU$q-5C*7WsQ(EW7$ca(2xWYdB+Ea3BGftlc&gJ&m*PfEoY9+_ZdAWV|wWs9tmS3RH%k8tTJt3zROpdlsd8K{I@%CwzAS1F4oa^jUj<-*1=>7f<oa^jUj<-*kj<_8!=XLfe$J-}}$wuo_U1^_cynQ+W9WY+b>+DmFw@-&p2gl2KoqekD_UQ~47xepe_NgwgPgo$Bv2yAw`(2OkchBHM#>;tKzw7b+?u8(Cq&je}>vuiA-*Jmz^!#qFSReJZr{pwB+VOH;XP@Q*`-E|%#>?qN>Jqt_n}xDPzu^vxF+=5~+qcT88Dm0=3*@|N9GS7>2;>y>4Wtg7>&B58JB~n3CHdg-F4<w;bABP&VrJ*b6mbm0ts<?v<s8zUlG6xxft<62NpxbSiS!zAwAa?!;d0XLDLI`OK5tey_DX%)@%qF|R&2bS*Xh%a*C!XusIhXoEA{Cv(5DhgjF<B|eYy+uX}B7#Pk*I8{RR4TOk5!6b^7$<^$CAfdZe82KUOj=71xQgzR-sUrwt3VA#!%Mr{ome+6&~orr$f;Q*uh{{dhUA>i5p}l$^@3Ui(bf;h1BY&$8WfEN2|A{_FW7ae$#<Ml*^t-!9|Owv>F@2{TSUXJ+X_+H_%3)Pd5H0}m#K$Va!O<g?t0aq{_ep7O+7fGKsrKqbNsk&kXm$%h%@#>qE#ii;U=OYA)8Kv-ssl|$sC+miA*P0innG}+xO^8IRFT+m-+o9zz%`>B5Wg(jj9ao`R_+@`a9HIHWx$$Hl~2J0pykR_9{6M30T^G$+pJt|Ik<SXSVFhxh<a!y{UMSggX{N$+xp5~|c9t5+ctnrcGQyM=t4#Y>cBxR$oDpm-Un~S-L1&g1gZV}_0h(Z)0g~2dHA!6WxSJv{)BM_!t$Y;cq1kz|XR04_DQ}E2F3;94qAu2(h${d)1HG?I+OSAijUA)ZmH7Jp_p|%o|$euiBsTj^fa--P}jrnm3W)nYg*#g{3N8xJCO%HCGY?jaAlHQXvjT>&Q6ciFn53CQV?j+lh>J%iBHhp%p$d~hU9{**(niY?lglj=-p`tJ?_kE)!LvvUrGvIiz$S2`ja0yBh+p)erEFRRy=xO3`m5a4mP74)<>7?oV-f$0Q{qVfSTQ5(%%_*LekZ4}?ec_t%82;hMG+w0Xe45ODY{5Gxq7c0@tQS$lA>Y|DTm9H-tqlqi$@f|-KGWFlp<7lVl}syAoq~W;OsoEnl2b4`Ow<wX$!-X5-bzQ|a?W`#u8Pz5*{*ys(2CfgAhC?>|3-Wcku4wceY)GVe_exu!V=u|nq_I+$8p@|Xj-U9O!|t{f!i|K;oOQBHkb2l%mvQ&Poizele84RwB&|t#q<1{bqnx05rwGwUCr^H^*qI#e-LtK>6S)4A*7IDZXAfbdzZ)SWV@~IU(?X1lq9xOec0P{?c!;&#G!Y%`28eA3phnep&Qlfl<;X>wggX_Ep{om@h9FEZ?;fTnD`dF4-+`lq8i=?ctS#=8Q$k7Q1JO-dRl}Cy>0Zi(owjM>pq`R+!)l1ojoZyqaaa?;)75sd!<o&?9}&<k%A9S75inf!O)Jvs?m^mw*SlCr7KuuhwJJO`5Mi@v_ZCz5vaHv>O(y&?#s1ioBKJVA@Mx#^YVB{K3lE#yKu2P<Uc(JJSU<Mx$X_I-a$B%t<nvq0g7>zvB{=;SYEf{wv$rmLNnKkF5~-6@`UPJ=d&NvT`TS>5rrs=yq&Fx*?U+sZZ=>W*=mmIHmVm<bwrYgLR5@i!e`Z;`QSa0`4c*7@X(x{KoV3Wrlq%1fE&#I&v?!9{d$QzCAh{ZFG!0M+zv_#yQl&{V;B1%;hlVWasSDlqPEeHc%JEgywFkQ%kFlxIt7JgG#&XJIqkp_VUWX5wcQR<!$aCo@>t_-hdk9oyKFPfH>)&0dEY~kP-u9osUHoq$75nLbUi5;?4}*@jEq9{Omy{c2yu$1QTW=Wa_c9c1Qm&?$%GhzTfWTZA<OUb@UVlQBDT>Gc!qWRh(hqA+c}92S|~^$!@Jxc`q46XMm*im@6+8W&^ZMK#W{JjS9-He{upm(;8tc2;LIA|)Jj1j(T5<IL@;Xk&k+eJD8_=$)&YUTO*yy5A&5~Nld$BAD!EC0oc9w`5=c!h`_NC^RGD5jxZSXRNVfGg7ePT`DMp^vRGf-cYWX0#p~hAU5=mRi3UR^-ZegB2=7m+9bl52c1)@VG0}=$f;+Wj%xHLKeBB)4AL$06J;19MBHwlD9`$yb|S^^*2_^?(A3d#s_cr_Vq(glQMMJlDnv$ZZV64jCZqhwdDHt*B?G2MYXdTP95?VzGCExi#?a$79JW_zhJ)1uT93JS_G^7y=Dgz4RnQx{BS=U8VXB$}ZIcfkr<^DsMyawRPv)})}2Jh!y5g!toV<>;jzlKrxQMbMCV)=^*f*W{+Q+^b&v<m*sJp@!K>N8nmqC(^jZViRV^at~-%Jyo6C*+N;~MDL@fWZ;~9ic~s~V*mTFThS62b`z4wmfT|~9sz?si<vbX0X7eHS}7<bA-p1y!rRls4p6z=erhDAp@~RDr+N{aTR@@>?}UUxlbU=uze%@gvY9<p6YDAoXSiiqDc1n)q@=Kw<O8v}jhE$K%@!8fLxdokP}0CGYKBRp!D3(;JV1z3N)p@4UQI0VG-9_*A)+eu+Xj0^L?If(T_0jtzp!`(zr_!E{$spdX6v@7Z(s{b7OTh|_fyXMRfaq18}QLZOx~82Z+Ih0A}8!H?dY(M&Q|+;zYQ+CeE;4lQCA~MBG1YFxen%439pedoi!t*a*U~=dOGkdox||~`4Hg-v?gVw&yyM`Fjm7kQP-$$qoZ&+eHMA(S1plBznM?B>E@|SEkkLfuMH)SkXBqPPjlHYrWqxbl#*XBmAp(UQdf!#OG<?vy?*EGm^G#hTbk1Jlao?d@4BT}Gc~KeuN=S4(}zwv3K!Gw_uy7nypnLopgpkbq@=JdGd<s2Cf#`0KPIbqnM^ytNm3HsTGfMI?CF&&=IJw@bhZGuP*Ippk`F;jZp}-D=ZU|%$S73L$Q@3I{C8EqJ#LdEewS<>_v<!2_mPt5mVAV}U*B(%dF@WyBF7S1`*oXR?k6TB@JxEyCjl1Hz{%!#v9GMC+9m->Oi92wdEvEUy2w_^GOY$~NIaGuP9{#0BoA&w$s;)L)5y__K~z;72SdlVOjg4hkdk=vs`4<#@kWdm2HH^aC`RTLAIe)^AP=b@e4=@!Jn8~@NK4knT-#sz0(q#dJ8vYJf}-O6n6CD5vRfuq<jqWr1T9n~CVjoN;#MUv&zAYF%bB&(QMlHcp}5Dy=@nPsf!;z*$>7{2GL(+0>`yjKl#@o3MBeiYBwD5KcOzBPXwohX`dr^P+f{kY()a6RRabi3K&6Q(2?Xo4&P}?;3%L-ftwa5&xcJ)6@zL9cl*c>WBhNNlKfsqgB%67PmBT8YwnYw-mcmy|4a5)csbrTD+6hVIe&4-&NFUQf9M{<a6e)$SRj(x$o58Sb3PUYw18q=HP(}zh6spQ$2P)il0oLg#T+7Hr<_&(hFoa++n};pJd%VH(+_twhyb&pp@0}ix%!`EljSbWuaavnYvN-3=Kv{xoo2AR;5HZe)DG9t)ZlDBs8nIvQABPBVMoZv>VKO}wzlu4+v3%P6K;9)xXG2Odtfx0rvSP^xz5X;vIW6Rr6hd=1QVQH(Pwvw(lAJc7q>-9D=BillSJ@(~KP2gxC`eigUrV9r0)0<$sEHlLMea{5Q1#b+mhJ{uH2<f6&ZmD#XS;u;@D0N^YL^#CFS$6=TY;*ev<mNm9IO7NFs(dht3$chvU)X9ySU`x6d#7>7%swzvSH0~<I%h*0!gug1-%(u@a$M?4cu1oqGUV4eYxExO+O9P1df0(Pt+9jDT;^MK@p2GT??{lS8crNGvh;e2|q4!+~~Qg_bnGv<Ljv}^IduyZQo^8O|d+BF_iO*3B_9p%mPLJtHJUN|2yA@I;YtRYnH-n^^ne^&tJd#>_xQQLD)D66j-Npndd(ODX#lI#`?@D^v@bb7T(n$A`L*ndzjx>RhzMTYN&0Rh5mT_IQ-$c1OOwNL68W4doGE#;okxl$cGh1DHx+Lpa~L(;-g_0fE$^GqLRq5a8Dq^^tq<!@KOu3om3@%NdWIUbZNtz;Wwf3ZuBl$?T}|t>lIiZy(9j416qc!sefTX`EmKR&lHLa1<>btw9TWJtNa}}&?uapeS{yi59N*HSy6ly&As@{s+jB~di@?e>oUD1`G;iY<iEPGObJB+OU?lHckpp>@o_OxR<>yFxs^0?FA@5yO$64J7qw(_Fs>rAGky>$v^QFH@O9z#RYPckRx&2(&zDT$sl(g-W)<a&MImBQ(Kc9AS-!ONW>3i`3srFsHE)ZN^*NRp1{(+!Z%HJNk2$G-g+K(107od+n@1~14pUn6Y7hOs+F_pSqM~#tuLN-TMkM-1M{`&d=Fd1}t4iy|<QPh?u8LtgkBXex@Lju<8gZeF=YWaCa__7nYql<PFj-!B)5m1@n_qt3&P50tPT{X}x0vrk)u+&J(#QO%teg8lv{5iO_`iM4*??uO!YAPWA!^Rz2WcVI^#yycsyQ3P&_dyDs38?Z2@Zxiqb`VHE{BAr5Yz5IX`x(HfD^)qpQli6fHSbzF#iq<<$`b!i;Iv_zSrM6>0yGXN5S9hS5Z-<YI{>fvcDzDs6uNnJHVl*TqF_U=o`c7+ej`%>Li3f^Tk{{#+Y$VtHfitFt;+DdTGIyJ;|&{?H;WYK#V%hMUmDPw4pREzM;h?jH0$IBqqRH<J)Wt>wGN3u);TC+uM#A7+Z>P8>3d%_cj_;@75{I9f=!DFx&r_u5Q~)5SNr9oQOo=Q)7IpHrw4syUji&=~dVt4fOkMy17O3BZ*DO6c>e;&OLlxD0h0gxWiqnG`t|`Zq9k3?xJ(Bv~Z`Ep@9rZsiQDXs)bb#h7ON#qUEBOxeeDBkK?wtL2=6uBe{5+EbtZ+jPIiFyF@BWbwmlCZKMCgw(HG7eLb)cUO@A7^>j;8nD8hk`sBMefB5X~)33hx;?3J@hn-@Qg-o2$w_knt&8M&LzIpu*Z(jfL?wjwvynFK*aCZ{IEbbMNf&&?tkovrZ!K=4#Uw`p6$jHgIK0IiNzW(l$KfL+$?vq#FzP>%wn63ueq?|Ld{B+3OP<)lZ`zgIX5<^#qG3mF@s~JXr7msrf>szC2&D;LITnPLgW`weqH@zR@VcjaR<m4aoP1vY7*c`_8FK!<4$Mj~iU#-&34eo%PDdP0^!hOD=z<jtn)IPzL!nQY+TuB3;StE?ZMC%D7=rOV0kmUgwf($wI-=>f74X|v22@<dMZ!)|D9)14R7q5TQqKLa4(BC+dB=G-ytfwxC)l4j6mrQ*uR66HkIyH;w;zhO4c}#+e@0a-$rsvv>U2aZL@~QAt_tkvfw3J$3?eehJ+LfR19GI6lB}M{^#Ry%)u^ENuwdjwSOYU);%;$mc<S5RiW<v<%wZ=8{!NT9HGMq!RpQ?SwqfXj6z|0~QxvI&4-3JyK=Erb>`XO6^`~5ELi@YeZ3%$UeK%p@l!%!~#k`<p+?Eyt^adAIS7YP<oD|c?N0R?9)rrj>!-enN{7AA#;@e6#|_Y2&<LXRLP47lfIKkhea3w$S%br_ixNWdMYe`JmEb{;mLHes{r&?8y8{WyB}kO9{q*LJ^NhwaO-eeo{Y;O6ni6qvKPzg>VqNV~kH2))1){Xj^PSbyO4U)oF=l`tuF{z;*TzoR#lU>VO8Ud`(Q#iw_Ne)$r3ZNpwz2*PI%`8Gw@3|5iMQF})Vfo^$$-S*<+=mkvus~=xP)RG-Qgv3WE1;~pzK3d7wxWV!Q?I?}@vM)kUJc6%!7<W6TIB@U-=h0J^6dh6y5b}GZW<7e=(tFX+a|szg_NY@CZhLrRnXroYXT^?xAvb7to7@*WuZ>kF1XIT?uv*uC8Acz*MZciHjKRaugR=oOfqUIOhhbFn!eITEI*%KSFm5P(AKvp*hfBC<i_rI$>${e9?zlh#O9J{K=RlYkQ@X}EQ0R(s7c0l7akJ<?*-WuV@IXAJD-?UI8Q_L)(A>`^h(N5kd@#>J@fT1USD#b9Eu*IWn%;@?S_v)P&$1JTYiQ>5f1I5-?*zm#^51$V&O7amH~(2TwfqED$@o6<=h@UkI51@X?{ZTMgv07YZ0LX<qWS36cW*!c>YF#;zk2)Tt1oY(X|e@h*uM3G_(prHdmUDwG#0Nt9~{>2((0tPF962YxUEk*S+MCf%nmuY>Pfk_`i&@dQNn@qeuZ}!R(aVoX?)z$sAivEZ_>r~26eE#`PFUsrRaj~O?k)SS0xQ@%Ty%A&*vfwKXC$U+JU?H-6ns$ZgMNQS?8#iM91gcPpUmPMxBBJ@SH4;oNRVCRY6=ikJHstw#ipTiUC=_Db!8ajtq-KMm~^C_H&3Z&Tpn_Ry_d#3r%6_PTMXnUC^46QPPQINECjRjC{0=TG?(H%c^qV7q&aJx*|=|1~1sPymA=ahLXp4@)~NHd8T?v6sq0Ny-d^Dv|a+3rlK%mc}G?ten?PkFwKyU>PepslQRkm#f3<dDkNT3bJubCK<n&96G=niVLjYlJQKs5wka}ybU>by5vUw%R?w)`)yxzY4foGPse6KmLgdEl!H9=S?1P}ss3{qQ6&(fXF(vTfiQ~DWJ*A*Pq%ookM8@IXLD@l-%=Q$CAfr$_G7<!K3NJ9Olg**JJqb)xQrKE+-Hly-M0nG+C?B%6V^fqAwh?4rse<G5XdZnZPLopT5U#o&^qy`$r=YN$VqIEJH;ZakIebNu!Wvc@eFEA=N}=N#ya&BZC>0#+E_+N{P)|t+G{Gd9?EjP%L~EPk1h)h4NJJrWHUhEGStnjWLZTV+-4VrVh+5BRDSRQN8jC+r(Pz|@3{r`qGL$1^rmQro1HC~<;o?bH4{ph)WB8m<kXX7an5gnPZg!`Rr-?|@QMj5LI|#S(vk{3{QIJrMn_j3|D)H9%g(Ra;jby$TbtB?MwtQ@x$(s};ietPVrOY@NLfDYwu^sA+j6$`FcQ}V4i{x~FzsTO7O_L{aQa3Gy@0ipB@V9+YS{EgW9qwHZz-~^Ojzm78qi`X1b{F9Kfw<)NdgD8AL!pmD(v9sZS)XKwC20seSdhC;JbvbhPSN;49|UVeExVv3wBK#A^eH6SIQM#O6ciTc-1T8~f0i8jSrBoOpOw$k_cz%iEcG!5^lBa#3EN^-e<R#MMPUl=O($lNinYvr_t&J#Vxi7pDMAvNe)CpixW(dKidEcfJM1YHg()>zXSCoJGVWD-QHy-G-`27!9a8Y=GbskPqvTS;clUhtx_Jhjn$2+%D_NQ|QD{;U-IIxZDwbilp}3x2JnO=%?kDkD4=IHXUBWuis|T*>Jl$5$(@>f5G+8)p&pV^90VRnMh8hdU&OFpdz=V{I?A9a=iRb;O>gGib%*(5r_qC_ww4Ryqa_V%(%-mSLNKAoa4HJS5m6L8y$?2W2<K?`(3VUCBLQci$tj--cmsdCMYfs53<t6rcd3E!?_LQ8Ojjt9juCUL(_LQ843q4-W%k8tTJte1Q!i<;ma{KISPs!<&x<Jm$?X#~vC8xJ)w0+7e?Ng4oPtB#}<K?{0KIM4()WTaeUe4?6Q;xS!tt^?=qyy(V`;_DDQ)7|ov2v;_?NeP~pDsL+87t>?_NgwgPj8$UFXwgksm9x<VRSbC4xH=kQ;oMzBk1j15=URz?|OW{8zqDtFXwgrt}p0!7;1jJoY(cczM$U?Co4gdIOdA=QD1vXPRooKFXwgkX)dr&$NU9ydXc(BF6L&TY|(GH!(z-(IqCM4oSvym<h*JenG42|_m{|d-8eGi$B|`D4xZm7JIs5|FC<&c>^zwwj$sP#K<jQfhqR~U<eu5_a?Tbe(TSNR(rd)gUR!I2%SpGV<P?sNmeXFTPkVtrmF9Z9oY(2oUZ78H#Ay3;SL)MUpih`MFOc&(eYy+u2{VHkE2qCwpZ)@U;%$uaa$cuTe}O*nN!Ca?;eV{en{Zqw&iX<h9yq}QZHSzm?Fl&@3(0&&%Xv+|cebbG<U-l;a$eQ%o$V<(1(&_^d%6zC9A$xDIpeUPwR*lt9AGGext%!k?J^E+OUmc18z-MLvveVCx-co~Kxv7^6PXwyAKjLcPjMl~$>-B~$`fw^rqlrgl?XdTKDsR>pJq&rlW&gSGy`slod+EVi2aR~L*%2|lJeQk^2qi28H;SQ-Gu_dC*_gbi6}%PJR6AEEUeIh+9V{Ao$V?pezQ!bSb;d-9I9yJk*}1ez!V*YYw66VRdwl;rxtjcpW=HE%x|*BM}AoOy>TEuvLz*(Q{<iE3gM8mlbblyY||}boD)%qo|7jjXUv3%fk&-eaToF#F)2ZRq4xt*iPux`%%}_bKtv#VCRy({gEfOCy-PzC$z`6eL5ZvlwUv-WrXS~246%rMwwmqgW$R=Ma4Q{!%N1iixM{LkK8H(sr-cGrDM%z|`bJm7Nwy=^DJUc%dyy9Ta-PoPzwB4D;!%@uEod!N6sDvLeO25tGzUxvUrVq1Bzy}lK}lgN*6SOJcl9xPnmAnLVr`bwLPcWI=NT2Za1W-)^o%Ch<`hp!C^W5lN5`6R%z^o1ij`eMDWw*?b0QMa4?q+!tP{Kjz521$S{oD;lA%v7k9=gj-9xv8OuX$#bqW&7n*mT$ERl#s0`Q*fhVbUCbQG?oZ}lJfsW^R~?aCJet%wZ@63biPk2Q_A+43RZr@LMI*EJ|8ET??0K1<_1j^j2*(?UgIdcpe~&3c*aLIu8e`DQua#$4cR|0LRmJW1P*kD1cQgN=&k`8Den;Bz7p(b<8B8xdC}dS_X>rBP1^DP(S#ABMbpm&aJcth#?qL!VMo*h2I=^=-O#aaBJ1Sdm<`fK#Ltx)i=I5UL9HF0#cg1vmc0+v3d@DiYK6dWn;wy}S+ZgoHv<bk)lPE6mt?n4T6PLT?+rt#lNwHoVW8iyMQmB0YOja7IC)7}gsCRreALd!<o&?9}MqWkSKHR>GUas?kt*migW<D@sU*>*^2r8qL78LAH>Qs7Cgo9v1giv6&XgGa3rdaorbw;2rsFwchW-#co(kwyE`;h(xqp_aX{lmToW`P>idLO*Y-b^12nbos>fN^fC02rHt=4$rGw?ozH$ucdfXmL?oi61H9}#tQj{Ou#Idr$8;Oji>NvxNkkxWCdn;CWLDgn58fl0KcS-r58WvH)j>sJ@{Xkea4YL?rtjCwyh!xkR>ZQ0lEkJT*#wToK1g^cUtZjQvZttRG!&lT<Pk!RSLmqnWp_JTor1)&TJ>Y?z!G7Q!%wx{4pPHI+EDUHLq}!6yLxDsZKnBVmBuIUdnghL4gOE}qhU!~%uj}{Ck2Duv?HF8k*Fa{7Ks`{oZ@K|zILhH`UxmOMPX|0J2CTRHV=7umxqTP{1mZ`hQy;QMIx_4@T1!~i4IyQC?Lb7=>S4MTIS9uOTwQ5ol}rdhTLK*z1b#zjJLB;3ksZB<C|J3C?w0t^d*=}FlzbF5eX?s#)jOHhQQ&boLl2#5vM#~v{ifRC#EEDf(!`IPux_QUN*ShuzpCk^)(kkL1I}l*r_-btJLyAbVH4;6cm!D3qRt76Wqc)eas81IO(uc3KGPSPZ!Er?U>x?xHLKeBB%&V_$ztrz6O7=eYi;=B-%gXKGYKU*v5yoQjk!Vbp1_6n{)voS&>Sq@ocS&j6#JO&~>9$tIhi~e@w9q;8WurYX=pHY3YtExGk1pv%OTAX;JD41qCG}S%0%+gbCS?Qx{BS=U8VXB$_ilU5KrDn4K5P{9V-YVND7ONh-3IdKrHltsK47L$Y5sum~Co57ya~@BeFZQ(Nv;FMjfMsFF~_?4%=c4QZahuUKrt>{#vr?W(7$b30oo%bVzZ)RYWbl1H|s11a{u54#mDfnhfxiR{Rzzjy=;`YdMFa0J*q)M=%lkUA<!mv2uGJ3!@f`>Bzfh9)8r9XSymm^HV6L>t}-358}Q8UJn4ZJKOm57orlC@|WnTiruRVLL|VJ38UWZM-b^YOrqP5FyAWq%@YC(N0)vuox_1*)PN?C57z;d8zuqafzo9yJd>CR)c=qV9$t1L}y(eVpzYhcm==34|)D$yj^DNwy1Al3qlsj=u`lwocF6N6r%$lUBu*VS^0)Hq9o$<?AT<k!#X-!?eqOMxa`@sU!tx?ltd64u<;UY(!cJrO_?ubxJ+lwD5)fqW}s9Do~3g*J|G_=+<?}UjEY%4L`E2^;hd;zRJYNQxK{R#utN>!!f)o&ZMu0XQ_D~q>1#vDqcvyO%F|pnjA=$m)o}@H1bcazRHUvf>+neE(d&1<j#*>Mu%#(YKRGFd^}bt*HB+<d`^xd#Jbmb-qi`Ml6u#nDUGYl79fS73u9K3)_Re-=mq|As_K(RbUMABHaFUcl_geR%7khf;ih25sC!H<8EmQ=iVx0A8yLqYbJn>f-8Hs8fW#JI{@2Y-#+$Kr<F4;Wp*KK<4Bc;%}BxBsFQ1@YnWszgitNpsoG4~Ub5_sQN<UG{Vz{%#cR=8@DfF!0Q5SFVR2^QHZS*F#%4T;CH!^s3ufxfp5C6A<ckq*2MUJRnDLy7yA$!b^wN)i?7EMFl>yb+^?fi{#pn!cJkl()P<9#TJs8+N5U>H>L4OE&bqhM~Om1@cf^cgpJC{(4MT`#9MxlPdCNrbU7lDhksv+oyvnfqAyfcU{h`m5#)<Y$)zAaeBqocc8aWQ!;o>?jdw=Ege<apKO>YCyfY+G_%HymuQu~-;GpFqX{JqSH0u4%43$kUni@&(%S|qO-xB3xVF6#tnorFL~83$Mk+48wsU;+wjt$lx=$n9Z2bUV_K<AmDHaf`c-j^@NLmVC8uFg#3D5AJN_HusosdFSrZ?``J*1E6A&%?p0E(1ChYuHh=wZ_gmQ7)(MQxxB3KGg$KNPCUVFxPQb^+GuDBO<gS`B`<Foa++n};pJd%VH(+_twhyb&dl75!a)U|uBTZ)~9Uh|}7Fl*KzXP?q4@X6bS{M2vG{N&;ut(Eh>Gi2ZW^I7EOmS_<Dw$%o=sF-JI-Pn#deyM*a%NJwV5aDz2dEcu|<p9U$Xg`AQ?XtFv8#TNJ1llydxB&SU%X%y>Sl<Zg8BC9_n>6j=;S_)rF)ls1DDGpVvqqxZZi3O_uy3f+x;KIrO^w0V9FX?ReuOxoB#Cv%i=7I~X?0PFu6_i#qO6Gl*!nE?3t*RnaRlRAV+HlDuT=5x%<~&{gu2~>FnisVoDOOHvGq~W{vDO;6t>Q(=c7pqIyG@#Y8mK88FGamX*QY2RY6nFu%5*KrrdE1V#OgESLwE^4E^^%HxxDu!n*cG4FPMM6%y;Q+w0)OVHO2Di#Zb;KCM54L%Txb~S!KSD{&&6)<xaB|mM(?a>LHy+pTB<f*^6kqgRpTDD6m}VGS7bmQe5|ajHQ%Q=$|!=EWE4H7HJeHis9X*vcNJHQ4J+dv(O)pABR6YmjGZyGYAslZ_g#sHvC(_0{O7eC<)`SR%nno)F2JR0Nltd6qQ7dg?j=Srq4A+hnHHQ?WC&wO94ROB4}MgJOv~3O(?({y-QX*<XMz_1=dIJh=1OImf>saUszCnTz>5{g<?YC#CaZV^XTO&e+LdU3TI~@;YaO5mE(9;)L=z(FFv!XDLaW?zX#8{Om8Xvmg8Xz`L9xkdhucW7n}j?@8IL&;^ShXx@_4zMD^sqI(&xq)g}V#%8Qb+IT%-w*%?2G6xwmD@<INq2q9HNXp&a*j?Z@v1I4%d%__<li$cVrux+rYvV3Xj&7P7?7K-B@O5YYE>vOC$3^ou7-%?0kIr@t{%*W6TI6|>PJX%3=n9`!(W$&Zk)plm0*?zN0L(Q`yFpkOxZi`LwSd5H$G{vi&Fj63TkIKXA@@i!**)%coERzh2w|7q{fl^t?Nf*1!!E|}yRUebxZ+`hX!NtNF!he6I+qD>Kn%Ye9P5PKWmGyHUs5Xw{p77tg_AFvK!9ya<{}8oj;e$BSTr%}<T6;E#VewG&`$3gN2@cMNw@ssCnad%0d2Q}LWx-rj0H#;A_Gc-W8{lA`b?)C`!CVy1Fs<-(uGimk>o7ZU-N)@$QBkaFdjp-bU&pI_p8mG2plaD(<2@UC@<kFGuHr<<DK1Ob-bQUlizU4e7eHZtf!XjjTCE=`N+ZGp$%69uT=p3jbs$ev)^CRZ??+szf~tR<{AJtr_Pk_QoE=BW@?G-0jnU2DcFe-q!iP6DMerYEn6=&YH1Q@Jjll%}V+v|$tvXy%I=sS=uAV5(dYI9|_kZ%;n?HPZ_vu$(eDUV(?RC>0a+Me+N71)mefQ0$ukXHj{SR+m|MBjd@4mcy^BHi*Oy-<>)s}dnWMIPCa0`Q1Z{NQD;%ktRlWjw(<tY04yHEb`=F_`RUVZ!e_E1^4DknTCJw%qD=B&A)_;QJ*q<Tk$6v8kIpC1AwTu=ntihdj2<m=td1B5y0e3$3T@aG#e=^G&?LQdq(d!q=Rl7*XzFOmEf&(%MQe)#P5*NiFlkI`r88hk^D#r~LVaG`!1y#>fWulK8GtPt|&sB|U}%FRpS6e9Jn!x;jE^tgP0|K2PyP)n8&>z5H)wgPdJ`GgXSTg+hj@;l)0XOs=R4Hmr(L#dJ}noK5t#&8rpRP^p4g@_N=4ettB;eWT~(q#S-g(G!i$^H6RF*(AZH(Ry`j#gs{E(jch-lC^c(G+cg0`3CLi%tB*lY}0VC_Tdm0ObU^3W`)&r3aXe#loMav3)VbT*8C_0$0-kzF`WKtsu_86ptzMfbU~^v)Qj!>E>qA?jJeKQH)#kAfE;cet=mAW~1A}4Hq8s57}z}J_bQzU=k++uQFLSgMdB3+h*QQed?0pcI!g&#XL<?>8$2{E-d#`Da_o?Y@)38i=<r&#g)SRd1uDYjc+&pKf}Z}342E`Kl*btO&^k{3>L9rA+y8fJFHwb^X#W|9#$r6Fr^d?G~I0S%@&Lk);iDz0vnui@irAK@|R^<pY0?<b4LsQ<L9s5{_*$Gci;RWdiC|2!(fR%{fF1vu-$=h*><}JAkf^2Tu=KYs6Uxz%WRjW+qN+#CKA40;6dg$#lyjQB&}c)d?>6Bk3YZU3<COJe)Mr9^+ZNre1enjjN+)7KJ@ChpoZJ%|40puqL&ATpL|3#R?4-9iMwPI#qSqQ+rkaCo4Z~5xV~91mO_`ySnH{bRWeKB#D$+yEvHH|!IPU{Rg>LM+g%iY9mSuva69$aC%<D<h<k?l;~IC+imkNd5mx-bbl&<=5P*1t6L+DJ^0N3Gg0R^PSYVaGXQClyC1z(0@g-mMWBUB_4izymSaI7@(bznHw+e}RlFcq#z+c;gvcSfM$&L!j3KAWXl}8w9-bRN*pyCYbQ1)1cwB}L~d8JEME<9<Bil8gJ6{JWV3wHyf$8-Y$+2ek>%W$uWjF^f>fd75COSjIq8Rp8njjBlC)P6`FCe#jyz!c+b9-^4)!^kEMcOr=JD^Nh7!#-&ERdAKzKJ7)}SHZx9#2RD6FKp{k+z%Xn6?~=X55EM=qh1T#CH<_lc8oA^%My3VO1p1wXtgr3HqB`JZy#d?v5de7;%^#b$qCH#Dm=mXI*i=%bf9t>fmd;_GHhR!irn5(ytKtdVLZ$&L@&`UImFn;fOm8D<8oHQjQ<kTJA53yevkPh!MA>v-G?R8_8}44+^Tt^`E)K*mcXJT<<cZ6^W01^W;8P8FoxV*Nbm6#*HrVA+u2;`#Mr5tPYG?{vo?df)Ze7Af=`R>ebC2rnNN>Of!X|M+TgY3``~GdnwQ&c!ubRnOu`lxzEjWNZ6~XAcT;-gvO4A#X1z3>f}An<cOE+~lXyCvfk@M-^Qp26JDrBf4_`gTf61pYdLfY8E5Wg#kaIArntALUS25l&Q3-c$4zc2)t8Nyv6y^|~in-@JVM#LA-Y@XJ^K8abn<fba^QoODGjI+Pe#2?e&0z`zNADNu<fm*+DN6}FQ2%y^XrQTsh9E?#1OWBjj-SnMsL4Q1w7}e%x^2KR-9BJH*)JC9=H*AtF&fSHA^JN6dpJP%+afS~F5<UsV<6*bD0od07!$LX5O>vo|8BKS7AgJ}g1+(}FeU)x$8`6Q&$r~D7q?7KxHjP6QKO%~0wa&+!RAq$m1Z$=trQC%bL}Xgq;Lv{@v92y(61O>Ez{jej6{A6%!Dw%zs)f`gOA_`*<Wrys(ljC+!}?EM&;0tAN~MNZIP|A?L$wnRxq*(Guod7M`7)hg(KH=k-d-FZ_HN=RLH&XUw@G1fAYunrvLQ^_DD82xcI6yM=QYH%M%{Bf0xHwT!Fy9)Ha`f6T+Nmy<e|E`{^b|*YaDTCfrO|7qS)@Xq3p=BKp6p<GLt*iWZB<b$TED{mndmx><n&ahvpn0><Gqt&#js90aRQNXw3p5%kYIkCOEccO#?ydL9zy{q?V1984&G)z0Cdx#vPz<?kT_)Z-(>2;1_rIsp_OwUhvhtdrEbqb%v{A&-9X>F3{k^~LMEuV20W{5SvoWldZ6d47-A?;l{ur>M)?zlA?$`^S%d5&iw&N5A;*zkl=g^Y1>nd;R4<{DOpsB^fLO03Hl|2~*Bt$u&)I=RJ-7nf)u-FqFJ%i$N<2$3lL`4-|tQxGJYFia`$yY^bh1Dh93EdQrscA1Vet@HMO_1_eqr@eFi|I~LTxa*w^4%+ZZ=8<it`TijDf_VWxqD|d%~z+FVKrMQWZtdjg!g$Jkl$P4!+@R9{i)VL|J*sm~1CfgS|aB<xO;V1Ykr2lhhN$k9pExnb}kaBq&9t`m4A-jKosTVI#!DL(C6M3eZLX_hu#&`o76KcQBQNQ614Z4Y968{*#;+AX}md;U_5<(|nk|2th3u$Q?xW;(sn@VMYTSI3pQzaJ@ShzqK=iB%e|7yZzn!<3buNh8p^9BA$7?U>*W3pQk!FfyLTY-D){sLnv+nZ4Kdz3MSmd*;iCPx0N!BZ65VN5LvP!EkmRch*Aoz|2&MK6oPzHq|_7FR(F<sGDtC|fJIdM@3WtyQ<Z$VL+1f0O^Jaf%;lb7rDAmUHvC)F~FrW#2~2Y`fdSva+?6##=&|>F*QF+!12_!`WGcH|Xewwg{psxZ*Mu-X+`==~k$gR=}{rbEUV<wdi~v-nKz#d9ccN8T8RKt%8JfeoJu_hKHS}Wd?KU)))W#yqc}HEd2a5<I=0R`UMsmGgJNokx({EtKSwGuIN35BYklqR?vn|ty=DP*-|_FdAdxtviM=YNuEXcaVw^QaF)yxMzOcSF9i0pd6vhs`8*LjqYi&qWA5raYy6S>>KBYjk~J*)cRc)#N1U9(f(YP%h58UNp9E3o$rGR3@Kd2Rp~EkjY9(fc4i`&UURFXZU|gmoj`zO8xqnPU>-+6v5b)vMGcS2$&>^tYl?D61;PYbquem7y@P5fAmVn^A$Pb5v%LJ__Xn&b4pDKADr|EpQd0y{wTLM0=<uWPdd0gMaJP@<p`MF&MAq0~p#N+ceUnJoJFw+g@3{7^)@z=w@Jg#@FM9bIv!V<$Hn`sWKHwsA_sY;|GDd=|nkgeX!;t$&$MDQ~mx@WzIMMU7bfiA0ldKdbP2Prl%_Q_9DMHSURw|%-7ap?WcemYGzQ<!wZuiJ13a06pIu;0#?KsPD1x=lCpO2b<aGL;mT;h}O;AY9F1kfpr*Im_*&V360C<?lDe59>62UyueZz^G1TM>iSkE9Gsmn#$vW<7USvI=)}+cgt<~!}cM*4<-?Z9@;+bP>HJ<pHrsHtv__l_8m+jK{rL~ciUOAOhdQ8f-2u60d@B-KN#75zQC9B#m}oOOf;H8aweo>LfWS!o^KvS`Qv-e<MQX?f9C6C9~AVI&B04f`K0(Q-%PVDd`>~NUJ44z3safF)B1gIo$rMK3o0xZe%3Mf#ouSsc>9p7iw}DL#EbvQ=D2(f)IVj9_Y{&~T2y1`r|f;zGe12|Gd$*b%vaT~VbtWaWt`2h96=aNvnACnFgWp$<J<i`?yf+PRLvi^WP{?7Yq_$F=lLvn!Tr1#)vKr39zLr4Ih$um4EW$9`O&Gz)A?Vb!b4Fg!WY~3Vcf!c1SaxaMCb`(JP6)KVf=<a*GFzCO)(^4br|6&%c3w;<`kA<#k_=r2xxKCM1|H+hh!^@C)M9nOYI@5(@GyEz+?tKZJsWY{c;!AW{CB2f1j;l9{o$y@>hzpk;NHG-RXhe<Nfxij?zrRkihJ#;mX**9Dk>H+ad>S6h_NQ+uEPnn;WGZPGQY><;&N993QCQ4p_*jUhUOf5wB1P#xr&dQHpTpZxgQ=WxZxUPrPE3XPW=*;}yX1R{l-n6{A^^Z2E5(uNaNzEk8%RV(>lk&k?T}EsH9qKSR6%tI#5e+ut}|0UWRR-zr`)S{u%Oj(Ejrh*^K0c*STd?avag7>$q1KYYA`FL&|g4Xa)~&OeTv#aBPe=i>zOG5mXY{qvYVrC|$5_;3xWYBZs^qkH*2`Z7(!(-GWbH)7)OR!}&_n?1lxx20Q$&9hevEREQFSMzbit*qD_7whwE`(qSxU>#<`{kB6qt8gy;eY(5l5ss_dn{+q3N!C03|M6oMu5L|s?|0D`;b+{wh<@NoMW6g*D^F*H(|9igd5W+-jJv}>?KkP9{M^YNEO@sM_sEMML6w;2wm84o;#<;C;4n%a=Y<)exfZ{OiD2MBMA4AJob!V*6BYeP$OG}TX1Ldi^2iS-Pcf=UnJgEiioAn>7t>^;Na_QMRE%y?CJvsL&=WXO4HE|*#-LDolu#l4c}<YQrxd@V*AyWSEsuT>7A&6<fOD)w&kF&}I00I;0WPc31jB2c6Fm1X<?y~s4(mk7p@nkTtK>NML5I$f6LFMBx``&`!IK7UN_pJ1dN~A|#b4~LnSjfWWzkGWKPbjYQ6!A}kXj2x@z;t{3mYq2!O-AfEfD3?y#yNZ3WI{+y4ba{ltF7HhXR!xddDzDieaS20)wR({8}+WWLpUVW42}^onyy<O9@vkgBapkF{;4&D2a{T<RA*n#H1t^*Ymjj7bN*${<a9<%irNA9L=DgqBWQ>I5*Z|xG*EJu)i9lQrCF5L*QThMNR-XHkE3)5~L8G<3rhUAoHtSY_T3VSZmEn7;PjTW_!)b(aW#)u;rrR*d;jkKsN|V0}da9;S;=40(+TpG&NBzJu1Jd-Gu#mzS!Q!yqft?EnIO@DttOEY~@O>_OQiD=4c+MmqYh}+b89)nlrB}U*bQ6cFOh7(Y^92Ab{{dO_)OEXg@KeP>yROc<EWh)qb|VOge~Vt1dh0NeNAg<dt?zR1xOYKDSsbR%Xm6GFCwh2{RBQ113LVoT<YMB(C<k^%WsCHycUL0U!_9kFlkX6Y?7OQY}HN4uby+9fY%@Ddz!+ql%N#@KCL=>ZGeY?qL;N^^rP62_S@qSc;TFFl9pak|4!(QSEU>T&YFEw8(3=Lidd@o_SM7{K9;Qp&b_6hYmuO@M>g(G!RVFT9HaR&MV8c*IMpjxnKI=TYTxNAXsGX*Z0{@@|639k2@nNKT%xTkdY_|<vxH=#lA!3hil6aE`*`waK6au66Cl#$USavRNATAO_-WIDT~%x*lNC%S3BSORtfI5LjW~VIC=h{#Dwk{h_q#ReGsJJA3_Rtj4qEt2t&IQ0}-697C};6zY41M@F`cTou;M1a@e5+WRT`6S6ka~twI=>r;qMU7&2n;6VId-vUIZYDkpn9;;6bsLtLpVF}Ut95Rb>awlWZXZRZ?zH_JciMg*m)DH*prB=^UDxjMoPM?s~FMW<%#f^f>0p&Z_rkS-<2akYazZ2cbR<J!Uyr+!irZWz9+EhV|yt5zpcl~T}`)m9%|dr}f1FhgSLSLOAa2ld0M!&Vb?5R6^PsO=P#!+Eb+DTlh+r{32C69d7cJt#xc1|qd`rrLN_{6oY8wL_?5fCB5GDlFh(k!<J=QZROmtYo^{#nw--j%!32^JDyIl%=J?`-7EFQSxeY31^wL6$iI*SZ7c{8;Agtue674T6L`mCufL<U0PUU1yLB?HHKU3W$D+{)ebfs>(!=TUM;_(AFP^mh~Z!*SnZ6etKDn!Ozk*^W$92r9LWtS4PL5stX!F@53-riIMh3=2;swz+vwn4$mkJ-a<GKw)gF)f0K2t^O9E7&!nu~TI1uOSY89rgcDltagyYUeX*Wlg$0oFDyi$zGa@C=)cD%){f#WbL_uw#Aks!qvtx~|mX)vo{IjHsZn+Meqc4aLRMFCYPNvZ<<vbRi?&P`wKYOB-G<N8=MwwyWy@j^>q^@+TGE9FERxLaUqF_R|UEuSc@l@#S-N2}|-%i;X~I6Z?f$6&=$8wVha=1zpG@j;lYJ?`Ny$-(KW#^%1_WDEzgIIfv3V>o@a+pX@O9CtB9>Hf?8gWyx>ezM$pap<S3gWKbcmhx{9L`m1MV51c&jg!La!+3TdViqXwUmd(0o=M3<mavs9Y1KezX+^bO*B@jDx4Mu-ienTtyn&Kq<(V?pHSDVOVRap@vS3#_T!rRBjwF!58p~Lz6T`2O;dpE8cupsOJ>SL<!W?baTT&LTgoZe)ltp}ykfFMcblhVXRmiQ6d+c;{hv)Q8^J?eI$PXb^d9~}XOf%&M?qU0%7sn!A&{A2WLY?Ly)%EVUasTRQMZeZ-Slcew56Q22%xx9;aY0)(=I)WI4E)U1zPWiz?jRThHz-&`JbjG1ByI7E8F7dKjk#XF!=*j)%-&CE^HRpEkgzU@W3L&2_1k>M<%1{>Oo}zHA_dXfDO&{_=IYqEe$%k>j`HjziAzQbWCT`-E9Va5uRp;lFY%F~x~GlC;w4m3x+Z&dbX>d5cic3p-L0T+oS-bmOJ>UfX0PAy#Y=sME`lW#xa`{X3ZZF}anfkZtGhTKVB5F4fK84hA!)sMEI6dg)s+1pjyhcDK8z*rC)0G72o|f_wJmz?ka%kg^Ock$sShI3;ZFE*LmC8{9QKj$#vOTH05Wl|iidMSrmGI!nzz_XO9rL<8sZ8(jGP>H3h)giEs?d(RnfdPS4-5mM&BcqA*B-GPD-Vxs{`rdZTrKTcw&yO+2f2)i6WW88$_ij?ivNvZsON(b(!PQen&@1<Cv)eH0!UCqxlA)62(sh|36`dD91b=u{e5sDQP%&<&bymLu`sx7yj`C4tLPeK5H|mp?gU)SO`{EYu)vG7uD_gqjF%0I+2H?C*NVb+9+$Qpw)>FqZnR0SZJz6D@KZ9q<7qx#_O&+jXOS4sfRbioD9t1im^%~AH)^co=Y6=jk1&bO%eln<LI8UPB2~FeREg2<JtxOLsW4%V8CgCGZqnIU_nKt%jnNt<%99%!0|L4ldK<nZm|hzNo9D3g(50jvDXI_hv({4MB&K$DJYJWo>jN2+;t&w`Gk!OKAol99NyJXoMR%u-=(`yL#BG85RzI%FP(At5jWe9+M7!&IG(9}n=Z?&ZlM}gzTYmNBg`hhEV9fUlOW)Y{@Wnyq@ATv;0iHsV3pATohGgyF(+R{wZQ`ls*V07*~;JxkoH!bk<FyUcdJA*8cjNMR_)CMjRx(=PZKnn3dL>On@Ji?OGBze(r899^4k=RW*j~lCYsS`R&u(xDKyI*H>6={0u8ip7+yeWZ)ONI7&p%1W+~B(K*I!ajJ9Okil!$Fi!CS;&Fc1M+(TS}+l1}S9DydKk_<gM(TqUTQrnPAsJ)pd(2R8~RPiI4X}VcRtU!%!8jfpC4>-JPQoNWd>S7i7Eb~nUzn5iu>hH%UAGM=6Atau1H`0UdSLi1Z=Z3Mk@RfIG?|JSD?>SGWQEP6Oz+T(1eEu$QMD}&h8@)VZ`Vq+s?6D|DJj%z1S5mZ}*O-xnIo72C9v?Yfqy<dmV$o5YXrU(CI88v9XYjuGI8B7dS)HoD`v!PJhE#=!YpgEQg_cEeqElVeq#LIUD_ppBJVqJefmo+19Oy!HsY1pFMt8M0W<ylquu!QxRY6Ur=w*!~{ppT*;nYYwST6;^O>nGJ*YU|JE*adNzGxfp)#zx9I_r3RCHL}_UB@RYjF#l^Pd<ME*VXOt{TAY*4jt(Doa0^NHQf+hz~VL3vped7k`u>5jd_P=thb>u`UqpF-r{wt#B=9dmr6`rV|8bLDU)XCKSUv3Xd_QOWK+E8<>{J&RtCuIxgV#D<7>b!b$H1!$6<#$Y}{aW*LYMoKo@}EC3^RUE>5LG7g6I&slrScCJ`ICG%6k=(rN&%cvlbIIH?8~9~j*=-ZS>90JsaL!keFl3hGkf=ht|4e7-Uw<XIo_`S=L3^W!l~9wr?iKi<bBo4e*K$|2uw7^ZeU`Szno_~mt$9iI+?r*`84rt;xs=hvfw`VNP{L&#Wix;uHiIYa|qqR%<eKtr-Z2{pE~7C4@<jSQBG$DUnE;1bM=cbEVVQDedAuI0Vx06pMtdbqgI&_i9e=w%D%4prci4sYv^P(}6Hv{M-lLNMJCLh}$eR;=zCPgaL0!r_QGbq7t!qL&S>v=T6Pa=3ptLJ8ruYnKKDX0XJ=Q&IymuK3*5-pda7c!<hi4Rz`dY7zxk*zXM>`tlaDGmZG};)QMJhbstWyXFBNg2sZ;UHM3N$X9E|jXLe}x;%yL1GkP(cK9ZHTvwORc{{%u9Uz{<lHaW3Bd5FeC&5E>;Bo85pX#74AV!C6+-aRi@U7gAn-q!%#a$|qn&a*L4wZx;v0!x9c#}Lp5mF1T&LX0^RAKZVd3Joh<t|)h9P|0%4Rhz`JH<kRDDv||P*^a!YkvkkL=X6Wo|{uW)Wj>I!gJ=dLKL_|rba5H_J+DkEegG&>WGzj2ome;?#>@$4^WH(AF1r=OnELQs^^q_hiYJo*L+;$9Nuzw>clFgyJANkV#mPeuJIath#tT^G#(Z=^>CC4oo0<?$G3Zhx!lKn`|$yJmj*P$^tm1JqX_Y1joT$_%7EiTwuz=PPK6x4tOS<A`cUd)gjUL@?4243x4=3kQ4xa4lG7dW9DayO6mvqK&Z-Rwafr0C@6d{oOpT1Nt0(oHYJqUY^DaXPVP(bYuJJB^h&HTt;%ueWlne(<jcbPzAh>dDTzGYS(ch&8!@L%<BeoR9R^)-%T_Z8T07bw;UWP4#=GNSabZ8khzO*Wg<id=MurZlHrxFy_-|cXlqTHN(@9)mC5e!iQRxC5-Y<IGfDh!Jz*A4|(ELCSlDWJ+>(5VDxmF@HsA@HnN-3f4;L@I<KD)AU}omxdxPKZCLWDB%<EVpuO$Wdie=u!{F$`FQiY+wr$*I3=j5xe%lT{5Q6g3zX17>4Tpz`}Z=xEkjx4rv^^G~i$sv0YpEBE+EwUco{d=^zFu0zk0N#i=5i@}Xfg7}MGSAIvQuH>uVVNf1o2P?7D3$VCV}YkcmiJP>!ua@nl_>5C$Q4F%M5TfD4zb$m6fZXJ`Oznb;z&N+)IwmM>N;o};s+E@2?y!S9=ik9zYwT-#HPq!0~=Rj7CJgF%2WzgRaj3H*_tYeapEUxpqB(4l7PB?aUR?!e}cvR^yX#|GEBX?%1tR1vMfU}aunGSy-dE8)j*GT@+s|-X?N@#VqPt%kRw<&6TJ5&M7#gMsvoM{w^Lpn8KtqO_XNKJ^i&g-s`eq@LuFjp?)=T=dd4M#_fEv*O6m<=oE5qdaeE$Pw&=MYEf4)-8KFnQp0r$_A6AbVxBJ&hSoB#U0^{;e9!)n^qSxm%41Q#wCip$qHSx|1P{L^gN4h@R{?1%UGnB^jG$a1aaP$dg1a9SXoF+9MA!t4uAON`N(BC`CakA%u|?tGh<JmmxZEQu?!XRa3HJnb~`Y<tBJFz{znN5oMB?E*%K2q~#q)7Ba+&C8uBujZ`xO)FANDv^!NpLpHRA2HOrjNQXHI$DL@`Qq*)RL*to9ms2Rtv}^3{%3L=?^q^r*J{uC}vV}`8$g@KUma$M3WXxf1=PrZ8Ljvz~$1Z~mk>Y)^!%$1GGvw1Tw)Lm`E%%Mxg&Ift!zB|CA?T4OcZYmDUEeQZl_y<S(B$JLx4W~vJ_A%CF}e5IO~5l5!zM$Md52b{;bYHtYFU9gwW9FeY=?hPEN*hUJIO9IL?_B~b9NEzOv2)%tH!!RBUY(!opX$r2$_jGmEnvGIlM?^gfOyTbXO%e8lnJae7NJ<bPY9uiXD4oM}M?p+FLblifHCS>iT%a9W%0HC8>(T?FPfUDy`B0B>(_S$fxr}n}Fe7WMJE&48>G<NHJzHf$5k!b)bb(T@ix{QDfk9*GT9z<ooePC_6jmJjzt8DGw|=z8xHy_2Z_8Mh>V>9XRbmB_L7<A#`l;yK7{V8lnqljMirdS?4kqljVUmtrN|BQFm;NPHI`Gx>TYC7pm)OpbCLxo!#A8I;#O%(LykO7D=5;8BVvF+&dJbq;^t|TxwR?usYSEwc?^<k)g^PlNGZ|_8}0)V5EJv;%tgIW+Os7!^FrdA|WGJr#8HGuG4>p;4<*JJJ0DgL=h0bd49SFQ4_4V9nj=UYXKuRHS&<J$OYD=1|zu<U3a8Z2r~;tceQk40~7$$lVt8R%&f~4W{!#@{pnU(XT-=;-!cJN*T-AUxHVmlqB!&}S>07x%m#cro)I#0cFNlj3jIRCu;bG$lbny+Z79>8b$&UnwM~aF&>@a2Io&l<rw#df%s!<~=gx*)#R;b9-)_LyO={%mukx*RslbJ|T^$ZU^SH+9?j&j304)H5<>KsKOnzzu4Za<UkP3`p<h_qWvbRoE;BC3C?I$hb2D7_n&bT4EP#&vto<$H%@rs4#k#UDIjFDqEp{itaovHxSHL@e5)FGs-SlyjutQ(>U>p45S4AYb?gqCW+ZE831j4><6O$%kFyDmL=E+Aa*aE&^Il_jUUmTY+gQ~@A96y$3zG3wG4r~4<YJG2pQ<c>SDI40WbREUC^qU+>NhoJJv?CvCA-w=H$S7b_P=;Ktr=;aA#N*!2=LwK(J$X&{0+i|H9m<nAKGAA`r?ok4tyVJycy;?y25Sa;fwn2FiE5uC=t{ocCFbn%};dGf=uu}(^#=PrdwGPo^$>}037{kJoucn)*i#A3N&|?@wjXbp|QX6(D0_Han3i*<XaB+>*T`fQ203`r-uk`t`MO`lRl?R?33Q&eC!A6G9WnRTj4QQC#OqVJ6xX$aYB|GB~Rlr)poITb(k+67vbi%wtCyv2PG;VNIc^x}d;)T{-akVL~QkJal+LJ>LQHqzs>C*|MDPnQ=_?$hh7MS@IA30Wv#FAY~5yCmAI!1~K@n*rOIN52<PB}m=B0NSty%A9tF`V$UvhPrf!S`<?t)-FOvQs@)Xw~(A(G)RggW(;OD07ICtQ6+#zC@eA!Nat|bSTR!CHP1iswdp+(v^hCA*5?1brpit2EV(W)SUw~CK=XhJ~OLxse{70z-Ya}cxH0sebr+k&`zZ(rb0?@QfVq~FuP>?3t_knB?(TH)D&^}_7`w8oQEqMW5(SvA!(;htdyPi4otCAdgON3NNhSpA2#UybeNsWS8S#q7}MHNT1!3h3Q8>_YL_;YvD&LHZG^zK#_jGrv+4kqDC0zk7@8*wr$S<QCkMU?Da&)Ykq>6d#H?LP(YS`_TKAaZ4N=MJvO%L^W(kQ^Pu@h-#TzqZFiFPP7p2F{u$}6VTClDQTPDQ2M`m}81hYeQAvNYWI=%9JB3*G&h4tHo*2+6$M{XcK-gk}^ZH(`HS!;^hoXF?yEVb<rB^YbYUzgV8!ohLEwnGP=S)s<>>?~8_cIg4nC1lqP6<glyEO}ivIt-IIJkC#4>H>}#9>xke_RVcb$lIw4r(CF0Na~_EjYmFr?J0eS=)!5u&kUm`98M%{ylHJ<-ZMRNem&#@?$U^baG8sa*QYjwv<F^y=NW|uXarxa34gi<IuWqA>DuJop%KNo7`biK$Vl9&6^(n%9TSR`@hQK%wk*O!bfXnxXIn`vqJleZLFmvBKD!wC4)H8Qa;KJ@hCb*TO)75Vd9kKo8Lf?I)6}`hW3}a&a$;o0k3-hxE-g6@p_J*Ejctfu54`Rgxt|B9#c?npak^Q5B3n4cJhJW30|diiY9FD8W7_CWMJNxPJ0@fsLf0d+yGHiuA)3&bTjz9Lb1Gex{>SvH!gy}%xG=tvxw=yuFcF2La#9;1W^M4hYs-N>L@!_>hMi7GEux}o&Jk!0c^EX|RsG0Ygk>6Sf+;tc<Euk6E^hKE?-<v!PWQY-LKG|9*};E3$M?(AOx7KGkeFmwjNPOR8N9oU#A_y5*9BYa;~J~GlQiH1Ov7s~!h@pI-N~A4g;mt}b|?Z|haGtfqD&v&sRzt}*A=%pb~FjzY7YIHa1tVA(P|L9e&>9ENnoOHF1Z|e5`M^FPU->~3(SMiu>;^j413^p*T{q3r-%Rm;j24c`k%;F?S*vDtH@0$%(*#kXdF_fcPavpQCY{r#udA<2WEHe8Q6!YL<5jHyBTmIX2>_#0zfN=bH&`qpyQawy-PWG<|Vq~dKV(tBeT0kI`{!P!E-OIPH&E!N*DG3j(j^*p)j|w9{I4Bcj^Gk&)AMB)~Vu2FE1bSHnY(W(Sf#D>GteBFR#DkZF23<fHhK!v9~I#9QK`xfMA1lZ7Vw+H<(?p2T;J6Q1<s^51=XH;7tJFDDX-4n2n(#k3PYSdo<Y&Ett4yf7#~)f2?Iu|NJto|Clef+6xz^ja~TO{rZx3FM*S@rg+a#=QRHD5b|<ZNX4J>y5<^j;ELH0&%X7dY=wbcId3)DUGjJ?aI?Y}d)0Mrmp#u7{2(?u|JW-sP$5%~Z~V^tWpsM4zzc#{ekS1M+g5?6;nMI^o})4s2R5)+VrQaVn@=Nf#*OE*UcMxe4RC`1(u8YsO>P&xM+xkdwCBA$I-hA^1+h}GKxr7t*z{I`mE*#medGlfX9F|uyg8HWvW&gRk8>XmP)~Z`((8JGB}AF$CUSA0Be}++C1;;}@n&e?X|Y<!S@&L(#VxS)SbpeCo0q>lM5cm+F`ilVsF!Pjjb!rNpI(?tB`}1Aisk1He|X-^zy<HbxwhWDW;+)-gMgBs>2365ufPfxkm~$XuSky>xEf*4d*qT!k;qNKUvXEnsIC<!c#gD6cG*+9y^Z!;1i0C6H#Y!r^WK@ea5ZAJe~)jyZV>dQ1fOj4iNsKEy~)8k(vD`07BB0+#iz6%VR@xw4{RU7SrMNgy)kD!cIjQ&z!9UvGmaM&1qsZobHxc;o!Q9rxPg&(;eAev&0o1OkK8r4s(5Tx=YG-tc3>xUnI@&_H!fPUNv$!}<yp)*K5Iu{X1UY$l-Z?Os{==mr>HG~)5y$Q$jfl1{rMbo(N<yLC$Q|onJr&*i6HR98g=Jm<AOYNft!K2@NCw<_&I4{=}cL2q|S2eTQlTjVd|4-o_2ha|G-NK-qH=1RoDp(4=;%i46m!u5ttfQmLjN2IsTS);ANfg=Zlh&MP!hZgFmV>4|>`2$-ocyD9$Y8swAU<t>T=Wd(aDabg`HkJ9kqTU3>}btn=QVPebERVvw814QG8m$S%Hv9+=`Ce|a9+T#%0@u*0e%X9jrTeZ#=eSZid<7`~`7RN&~~Kf0|`F3PU~EER)k_k0ODCih?9A~Cnq`I2OOL4&|ebEeLn-$m(L13zn9T+3xA(1D-V{(Mhn<P%+F#JQH|gY2RlYk?gE`{!$=%U=Ejex7+Ww~K=P0`}%0z_@_F-sWZV_e+9)g~zFkx0(5fRF8oX#Dm71ciBaSodQD*^PX&Xv=^LkD&ZjvVdr!5=!9*^OfoOeca<(rIUac8BZM}izbM^g;Ha5uS%Y73Ejn;D&inJY|H}Ir$QkBB*Rnr+(ev)W&vM1jriF`N4g{87Sltq6U-ar48EVee`4-?+53T}RSg@SC;>+Gd2Y!w@aqikLyHAb`vDp3jish;oRe`P3{QN-b;#?`n(lUH9d43e~0iHDl_QKc}1GxIMUPA;^-gatQ|Nr0KxBs_|8;Sqi`xovPR(IdZZY7!k@gTJ8{hs3}8@HRs$98txO>$mJglu*7Dk(W}bNSzI2B0KL0;xy5?cKHc>?Sse84L%5c>sgKqa7|XolqHahtfJMliFYeB|sg9<nVo29zbv$tjgN{d!0OpqCC54+|`+}^3$|`d#lsT1M%{P@u-<}%u+ZG9NRYX;LPDV_>bPp@zgVoi+BHimE$`>1KzZrhS$%$5j3t()0wW9VZ}?dR5_Wr*46BQXMhr=nt}cB$X8{Q0(&H}L2}t!#c<2vayA-acRzzSqz7K6^)N%nrlW!5P527@hSDCCIrLoe7M`LZdpQQIDarvbLhB^Q4pw&>r&FEyrQjSxz|yx7o;U#H-SKD|_eaR8z0ea=w5s$i$9uB?{S1hQ4}d`#k1{V#0d>x@@ob9BNjw;s7;kni?@Hk@#j>}QVTLnw_5BO)b_R5pbaVGGK|X?M^^X3chu|vCJN6*5ncjh*-GP~OQ(>xu<3`KB{oC8ybUd59hmi-t1m895rv1q@JDJSD)?{}u=pS^-NYi@9{_xM4;pRBi%~Ts!CuLnk1aAcS*SDegiVP1${;zL?p`!zsp8>@xI6r#XogNHY*69WwoWR_>^P1ZG6nriPG)W$Mbl)m%VbUu-@5!5s@1EYAzk2cF;=1L9J*uOSP?_`+yh0=p5VW!wf>#zMGSnULDWwQh8CKjaM66e@-dvuyZ!X*4U$lR?xqS2T=He+}k3y`wsUYSoMZoZMt_#80^>zEjYoL*o!bVt}!Si0fdGg)G`OTBFt9Hw~n@%TL>*ORJ#((XPAYQ-iPw!?Ozdt_dq%Z*Kc-owd(`h_7DZ@+6v0KkOe}4JuMf>LU+4b|nXxxs+w*%cYX&|~3g(*!3!l*}yl}AU*(B}#ZlY(Wre)U89l98L2?LS__;Jmy(JHPf`pIu#j$p}e5P*ez{WEKC})%ADn{m^>^6pBx|qZ_Q24gLsS@8;R7H!q)_U0=L<NrOE*i!kLnT>fFsZbKm$BgJl^x9{6GFWP5UZ!X(UZ=Sq)`fdB#`&2{g1u>|8@-Wp|t;NA(R=CR5sDam=%(_$1e)&865KxcBH|OI?A79Z%Et^dslp1Q#$piB^$-$@$z#s{QO*+#tyq@EOK%XliS)(?LKlX>S;Z=V+CqxGMpGNIgkId559AWK+j<Z<`iV>nBnAu<_yYNefnOD$k@ZfbGKr3qR^~3ZI6eL8Adf0)-V59pz&^dnXvzu#*V9xTIs+<@s;WmXfdGPLa+V4Gh&E~u#TqPLyPUbvbJoj-!8rtCtulDbSSz3dq;LpKhaP4}7{_Wiqo`5Bo%;wnOMWQEz@k7&40`38_WsWi%&wv|%w5ZJtR!cV6wA#OadvX2z&6As}=V$l^?9K9-RZ!+JxN!PI{??_%3XS6FR1YUpXTw}u)k;{7cdpQd>G&tJABWi`rWC94f`fxQv-_D+3&>TuDK#xbz{#VUQj1lf|8kfqH3-0IJj9e**eG~xQ)=)=rrO7$rqrTPSfshil!oY@1%$#^fGPb{n}9B?wLFYS8eYwc@A-H*>`&ooZP#(C0qjD;m*Aa5!axLsframO<G33O1|}nnqE6C{q^8}t7fT&4z`HTp5YVwTGm1ix5byh1P<CnL9bSH_!Nj;oYAb^c&EV;ooec1bd`7%DospQujK<!&cN*eoga-vL5kDB3H|YQy?lF{zDxOS$+pk80hb13}&<su2n^E^J9^IOb<}B`xCx)Ij=&J_^=Q4EY<8D_^@CRHr@=&FC$;@O8zrJiYtXXrmpA2RYBN!4e{3rsxy1Mp}z>YPNo-oVkf<^c&*NM-dyX@*Nrd%LRi4@=`=z#Tj+@(F*A%Y|-?vWsgNgPwERMI11x2L<D#FU}APH0Dlw4>p%sO6me1<>Y6*H8K*jI)=xgHEEOBuONADU?eT%&5aOmeK3=U~FUE(ShjTHT6+UVcsVp0r{gn4N;I%bkp+NDFX1Op4p1!kByI$oj{=3>)(RM(VPHH*?-*gG9=36s(b(mYLztM5E7cWU^@O;k6PYufBW0Ami9VM4-{_Pv7S}S>&1gimjZ-XxzVMc7cF@7i28YfRpHUg1N8G8L1+Tu{q*w!Rz~bG_46DrGsRI4($5PN45eYKe#X57hUaMxiqLOoahiD6Nhw9IFu{J$=)8#7<xb?tRTz=|+=)3L3-Aa*skmZ`@G&Fv1y)(+4eTPWh`=Q8A0Vy(%R@>ZU0e~bsRnzvxFQO3zS;9~=k)d2x9uxy$jTrhiDzCG5ZAB%(0*C2(f~jOly037q4hO`LhygtK7aLn`|?jWPus7*d-bOm?U&bA=+0PcU$a75Yt+*52e5r_Kh^pPhL9oNs>MVIq32x;?RNK2YS|P*NdW1OZXgo4O*J@9joM&*Yutu~*N_iXcRXAS-o}v4%?Nla*-63AIr;Orb3(u!2dfbPVJh!-mZ7Udl!zo=#1TfH8;cKuryRIG|DZ6Ey&#Z^bV!E@)s4c0$5Gr7QJ@L!388xMKB0vV>c#y5n6k(E7#`tYeEBf~jIN-BZ+r|>DpG_jKZa5nC@L4D6HC?+tfxg13DSvU#X6l%EW0Aaqjn6Qa~goHD11yd>vkV;WI&ZLsREvV49;^3B2LNr$AHH|vEtO{_YUpGOuD5FTAcpGJfgJD1S`d$u+UP8Ghv&+j19Iq6M0KTjhUSGhZ-VW@DI)EN=fr5FcogW_ej%mdea@x(D@+c%|l$V_q<diXTf8;>5ry5y^p~p@TzVEF)AkppdPU2W)u%~%d=x=8B_`y38RE3HYzT4jcjXTj#;>EP2M6T;bYpG9ILr5@E}{0BT$F9Mi$myDfpPSCdX^eSR80;aukZtU2Tnp2pNicwdsJCoKY-J{G)e-eol)Kp^m+`U^aq)1@FD58sx>soj=4WZnLz!>pSiJG?|SaFn8l8Ouv~8%<f&1H`a;oy&h;>D4N0lvDq3LV3bx!Ci40th}GiFZKpX|l;C}NM{fYbPsRspHm7Oa)y-r{6K?ALgd17e-S~s|0m5r-Rx&?WTH)W!>!un>I(GIWG3HY+b)V^J_YOhkQ_CCbX>3v+abK}koMJUhJu=%!AI9m=y#aI$8qtX#EV$x$AHy?H35iD+=#R4F5&%jf%mF?}vQ4ClUFLoz1~o>*d6W2IFpiT}84^68@}u{u^tIU({8eqCNctw)2fHB|m?NPYWssp!LBFaQPTZKC-5ZF#ao2CZMU9dUB%zqb`>WcxpLB1GqDH)+s%xbX9BVeYEDOc7!hqqy^K&Z(MMmPl?n-aNLj|;JYX>P3ND+)<>gu=oPW{HnTAS(Es5bBtMkhiwa6U`ZW%E`6!%e~c+Qh*r;E0H+#CHe{JoE#}!F48^G+_2O+A&<AadmC(t_{rA&Ou${Eo+1dJfC=Jj3(}2Sa0Un?&eCNhw|u~6MHR_=Zk*H#xnW;>Ya!=e+9v$sYlz1_y^>yd!2yW%K!shVB2e*AP1zXbe$k?!DaB6zFUq}5q_ZWW)O&gD6zlqmcw!(9@lrv@hX1!vX(_bXt?t_K@P#tI#>B_47W7E4iSk5EdHT3D&{l)pBokb+^DG9sIXHcB+L}@S@8m<Xml2q<@M#Or*F>NmkSksx}o~ZaC1{FG`E0zV|8i&1!i-8ay#a^C0R#bWnmV5fQi}G$Mg2tQ)?7YSB+#9Vqva=nmYzq-=^o)=WCN|J$U~wTm1KKRIgy*76w$&zWMIW<#&~zAVUno@=wqoQBim+qjy^308}ECxPo7bH2;*-eLaRb`iK;^EmqM37f#pwpGr(3C?&N0?6j8ZUUqT^(R+3>o7|>xqEC7l;2OP818~wFGOz-JCgKOn5jIm^*`cDi`ZpIvyXJ<TTmN<x4^FS!moMPApZkMBGww}wdP;)K!|Q0W)qS78#LX2tmfJHGokxKR_w%&ofLO25?P)DqF!hM5WDBejJ1kdnj(`%fx2Ls$Wg>V?PiuiU3J=|pnWG4)-DukGX)PdxwA)M26m`O0U*Z<|ds6y|%pCoNPdt0kzC62mdU5vcOEB*j=N0T`q4gfm&t6}@xoqD&dkvq&N?Y@MsWET;!^Kl%qhLWPgtW219O8NV;@jsaqoNdq2lg{wy}5>OxNLd8f3gyN6&X{CBn*mTw5IJ>{KirgJmO_2w#zYBVd#RMTaCk4d*(d|W;X~Owr444U$P@s+OavPx;=hiLUGL2Dl^T6t~|0cJARQ*lbD2zcQ7%tT3bj6zR4xm3j;6H-SH^Nyk_8oR%Jp45R-;@4p@RkUr$3JL5pBz9b72lB}l~*sqiB_sR3%0N&>1ztfLEC0rw*g48jG+6?Az%@%Qb^i)R<@r(cl23=@-hQh|kzarZCjs2&YD?-8Xrp;4Fdq^lunl}RjON_5D3-LR`ENn|(Z>5devD;<;z5F8OQPF;Bw&1QcznN6G1hlxJT7yQ5ey8ipCdMPFqiPaQ}avToZyuic4!a<4t(0C%f%<F*}@aksEqL<abs>C3uSjT`V&WLD<#XdR7rfI)B-GWeIQqU^GPj;8#Irt2pi)d}FxoUhoEciZieEOsAV)%9SFzT*iyu%gui9P?c1+gl`5Oc)#L!T8i^h@I;*;UnfSN@5O)KBJ~6&~4kxK>T0_tC+sCPhS)?M%vfJk)9Y3eVQxn-_ai)ioG)B@Qeg-+{REcru-(`dVXh*))A9r3$>z#j2<NIBj;pvCJ1Cw-bYgaX}0y9*D~9F7fH_uU@_MCvlqTqh97?A<emf9MwzBuai9%p;;cSA0Jne1FmtnM$Y8t+g)g}fj%C_!$^OZ&SVhK_0BBYURz{4bUR;s&G)sk`Pk&->_&zRiIa>=-PJI{UqD7K1-no|M1cw`jlTZNEFK)?!-w@0#y+kzVHQB6?sP}};e^$XzjDD(=Ym{@W7z=d9n`DorL3?UV7WHOds-o%_1`%^r@E_1uFny(I(E7~8gp#bl!N{a+?=-C2!P{ude>N?)4Zuh%S<|f3+>Wa9Mv<k1Xe%x?I~E><*}diZ*?|3s^964_2bp9EyR|-l~|uii_tvYLwhVnXH!_J3E*5Z_s1_Wt@3sGd<WhNA`js0qKgv#E=kyd#}U{xzD7fpxmfm|cUO%ahHza8P5K}8;B-Y6%%gK$1z(-w=D9x@-#&9s?YZ^FW*N4tp4@m7t#DEE#5wIM1!{w|V+ZL^iW6@E@noxDM2ZrzzhEr;T$hYR-&Z?Ggep2*mP^C_s6UKP-}=5^_^|2tYKp7-NA=mX7Xcl^c-p-?8w`$423TI;oo`pZa7R3Q=l|)&#mm#9cggRLPi~LjL*vO&I{t9_&CA)aqf`9(EqPyUPE;TxxlS9NBK&gN&i?qNw2|U+<I12}_Bl0hF9q4j)`Z7?Qf2!pLZ~_Xyy|@6#!q&dBgW4=x{n7l-2lHve>^_@#{AZ_guXQo-!F(7|9oWOeY5RjA#;##2t8h-{zW{!^8wQljEIGs3!p(i8-6!~AL0>sBKWrYTSCRw707T5Udf9*uc_$86r+u!danobx1;NgxAo?Iy;1+mtgol=ZxgeuZXiU`@i1HbZi|oLuj3y4ZCsni+(^7{eA1)t7(Kw2m8Zr$qcSuJm7lkW1{MXYP_o6?CHHF@pNiX`E$~+T;)6zU3$pOmK4@6QnERWp74OqudDmEB=I1S6VJd2^jKv)&qEqX&e6z1VP}!FxYP~OrQ~s()i2oD^=JcCS_PG^Dq-4{N%^lYI?-1e`<#3dpuDHRzN#yA3H1lmi6g%<ZFXJPeo|?`!wEJkG*U8#DJFl?C+u;4e1g9Fz=*ZIg)#u7jk5nPbw4Z1r!PiLqs$8soO1Xr%+U2qW6G5-N$45E*1+I4FyQfYp#RiQ$J}K<DRtcZK*}PHC7#0M)u+!&xe+JAW{gC%lIsRGNJ-G!Qo_rT~iWBd39$)<4qJjtk;+aMV4;1M13KT?+d?|W>a_cS)7~HDQAd*Fe&*&D`382&R4!0~5jB^Y*1-Zze3v)Qm<<i4(mCUk$k;2fdIxGv(T@}xDjkcIYiPn?08#I^Lb#=Ek0SjP8kg+*daKExqD?TfSa0&G){AP=CYz_fOY@3gdE4j<nMx<yvnY+>Ux2OI1b~MhW{jQ6k|6dj$uMBw})K`)tY3No^2l&x>uf26I8hnld&Ro}i6a3~kn@_(!rQBAHa1O+Z6P|aM$7U<7jRGlv%%{)}Q4|Y6XLBb@u4cnw4AJV&tAs}dhh~MET=8EddNl1%A6iQ>%gw#@A6mKpu!z%I%Xo0ZDTd#MN5_6P8T7#_zZ)4pd2)owIH%tf2*C%($Cd5@XaH95%^d@gv%-%DgI8()7F@u=m8ry-U5qktZokv;DY(t)9L554djQZKkgolqZRy8sU!R&08iX66`nslSe42}KYwHYa7!hnaL^LbdvlRgVcY5VxJ~!%kh{4V)8sq}!CE6-?EO#~oIW%m@6Sm^+)ck_ZtWLb~WQx|$1AAw(y1@HE&%An#jFHe>$XKzam&Nz`A{!6P_xqhV)$I|=-z*(8>W{HCy@f#BGAks0tVRV`RL%qicQE)jop?0TDf;~b+?v1F1NhmTf5K-U7eDov(E$90A;M@jz_!ggL<iY4>5p6W{^$;z$?0ZvP)RMPg%IcWR~1e1Cd|F+VJ!j8#d?k$k7bL<CR030j>iIPL~LflzBwLC1Wd3!b3B%?5q-=Yj|E;u>;c&Qb3B$P%;xG2IUY+08B`ylwJnvzYY?LKRKeYHk=SM~5*8<%4Pub$hi2{<qd!>Iw+zVM8Bn|TS~@k9R7&hu-)0G@Xw}qEKpj!^k*5Y?<(wQoH4uT>?>}H_04(0V_vljt@$y3x&6g<hDt0?g4S>M2e+aQi0I{s7_<TyGD5NmGdUDmi{N7|aQ~?QF!y^Y;u>HJ!fxKR%5ACpPR@Oxr+5?h#7q8FG|9~l7yZ2GtAS~@967t||vDJex&HJ!a6c`moJTG6pxo%gml`$(ac-sH+X;nj!%T`qm*|K$hQg~|)*#d$GYR4S1B}f=n=a5-8m4XX<kb5O1cc;0}BSF_7w@-R|(#b1i(|)-Y6Py)~g<Q6uwY)>}YD@8}fNwK<JoK4jDnPIFvi<UD`_emqb%k{fKg8*9HhF>7A%LmG57hjR6tY1A%KT{Y2>N>8sG-ry3`8V}FBWfk$Qlug{AgaH5adxb5a~LGp^it0AmV{97w<%*8nqAoWO`R?fe<!ociI%HYJqq)YDpS@IET;%z(Ov8inJe(Kv!ZVMbK_kAlm8OIH|R2SL5CkJ`58eMu|>!dV=A02QQuNLiF#&^QBU6oF-T@_Q5m7aXn*lz3GRsXZhmUz~?Jdu=p-c6U6GlwAw6{NI0HS#RIn{)pRpi?JF<vhA|#K-Z(f(B&O+!5Q|ulC9EjGl2TZO^~HHeAhwK_uxb}rN?Jh(GK9$=atRBe+!C0U0#p28aP+vq)R6@+-wBwtNQ4D)sU*doqXKYP3M?=IkA?wLco=LBOvz5b(vS^$$<)DK0JEKdRf};ScPorqTL8-fFe?KN368RggdmY9O2|&YAxr~biV*a6PyjB<7cT|ot&sUda24``jD%t*V2KrK6;{g&3k(a35++K474{qjs4NTP%;+w_jNr*`83|^p_Ah|>PQW3O%>zzFaZa(KgvnB1n9QLsr4mdOfH~O-SmG&eB`}M#FjSoF1Pl@ufffdK1qBJ?au;9@3}e2ecwt6Z)FV3q1H+U_y$y;AOoTfDb3Ap92f9L9_+}w?0+uZfrc4lSD<aH+ixL*OfmJIAT6i-bSZ-SES<;<=^UD;m6honB$#()~XjdiUjD^LXqn&^y{O5xQh?iU}fuo{?sZwD0FY*ax+!T3R0JB|y2`GJ-7`O$_3bQJbI{|~z7k)&*|5CDOZFT}?IIDO_ZH><ba8bfYPzo(TkNGl?B#a8|R$@13RAiuhLwk5?0j+j|rhzRY5-1`IqXq8KZs5jLO2+I}2}^Lk8#qJSCFaWqqzE4E1};F8`jHe=(xRazWH<1r72rL~Ohg#2?4R16*8ztvgaXkK_76mu+yjm<XLmR;sJlA<jydW@Oy(Ny19Q|1c)0Nx_Rdi+VhDx$@*MRd!s0^np*iXWe1dGI;UAu(UPLUUD9OEkZA0~|;*$6y=3EzukfAI~lz(Hxur}^@jJmoq6TP_hmWOYZDd+_XB6C;0n+*`F%m%aJe8=5vOjpt|XT&6j+?j}|kg&Q+#I;3vNPhm>x`%7ey^<<rF7;j6AncEN<H{uLoQ$NOO;1dTq9%frr(G|*!!mp8JH|R6{M|F~?YExH0e9<Is*;S^1)9|~06V>WJ-YXc>#Nnh5W10<yC&j`?i$Fm#-|kTCQVwnjQF`4H=d1JPZG^Vuzjyb)9iHdCHe3tm=^~x<_SdRx6^OTKYl+sJw2_@F{~%CuVOBw6jf5F==xryb9${|$8;n!zKzWf=!}zxi=?_+TXT1{TZeL64)nzFwz>-zvh~cx{v7hO5^n={8BhD0n~s(JLC8~bIsxJRcrw8<Af16WJIjswncY9N^CPc&fr*S>3Q+x2XQpl&!g_gqIE^$k%nD2F4aT_Y1w#O{@gvp+>AQ0+iWEu`RZxf(Q}SK!DlCE)4BsY}efMQI7lF5Y#md1c*H=vM?9S?!cO{D_k2br?bewkY8uj&wXkTK1(MBCr;)An+*&uE(;(C`$<qo3(ex<4)ar|NQ2mR2fFIcg`gVq|Cu<xEuadKq-J!M;1q$uH4{SWM&D~ozDuCxl%QYU>B;g|7!|JF=9&<7bve8W`bbYyh7q0XSAahf&WzOSS^vbV)o46Uiimic%^SULug&KWk;qgfN%p-YqLfd;>GK^)A?wgX2;_b}zl=4`E@w_I`Ne(j7TzXdBPP5&x<H<4k94jAbV-kZzsj+T0FGKe2^3eS%Hu}QM2n%LEH649`1)>ihrn9VD5drMc*Mw)lYv8&uEssC<a4z?Y+Ds&UdLk=^Qp2u20X0b+6w!_#mQQ-0a%v6;EwVeIk&J-4?5JYTvXm;Q8%gNY!!m>z56uFcBmaa;7J;<m;D8ryKgU$$fqrMV+*y&f6wOK?il{z?Ub1~}*gj9DIv4~WC%l5R)15-e&hyu$O>_7jDS$JzRep`xYvG3x6d&~co4EED~RFEsN{c0JwujI3DJ9V+7Q3a9OIFh=a41XA%)rmd(QAr|F=C!XA+bBQlF-kU0depa)xywi^CN_?(x{`sbS0i@L1K#;S$S-`*V^sxjKk2dS`IMDOvUxV+bHm22t+JrDVT^HW)iyW4|C$Y^%cu7DYV)Tg+jKzPNx-dACA~HA_drclnH^k`6pX>DDFJD+e@(rAEM=U+z$JDuY$a{DkS@GshDK)Fr#z)~(KN)n<M{4*dqqI$yqB)ff&}({f=9^PD`I8A0R>`<2t=gz%G)cz(ja`ii)4y;nZ1%>-@Lsd3SsNsZpqs#LR1%cvMre}@sPUUUseM<ujbn9%tpxow@8e8W6Lcst1r8o{x7L%UEo)wSa@hn>;IdaDp5fUcewGYtbJ9G1vEwIOH`0;p&sons{&SB<~mdbSp-}hqJk`Jeu>8;svv`xhxR_X!&Hz(!4=(E1z8Al>S2ot5<X)Buax-FyT-daOsd_{aBPYib+P6@SjB-ih_mT&s{~$>AT$}*=mL4QlRNkfEEfk6{R!T`vB9SG-?z@*TEoL*S{~jn-@v;)zP4Mx-;`0rl&!z%c~~L(=(wyMSGM}+-+*!=4dqBr2{n<evVea+)%8cbOJ!PbdHGKbZ~m+~FG{_9c{6_mt>z`C;qClKc$(iCjZf!47M?b74+;ID!t0y)GiYaT1b~<JhxwCLB{_ecKfSR}KfjGrvv3Kn+bDT|guj)I2j~cUN8v9&9wB39JRB645hsZ)-RaG@M2^hm-`>}!-ixz8=A{GAO{)FPlRsUzuZ-&n9`KP}nAOR#_qA!-etCU)(Y^vUeqZR`tn_HyKj~_nWL^goi@{rk5guh`ueUQxZuPWY%DyPSI`S81pR&_1=R+AeO4_TQfMIbz)86-3A)t+Gc}GK?We_x#eTfPft{pA`THYa?a$}bP6SyRcsu6L&e{DBvAxgj#lvwTE+~A`>_Cft&)(P=TFsXn9vgA^<*#z(ZSuDe?--}j6VwN5^??o#%$ysTy6I<IgDU|fL9!;}Qr?W}Qa02NDCoW^R^4mE|+fwTRBa86v8tlrf)3&^z6o%Uq1pQufG;W%EXY3K_mc50o6i&+g?zJhd13*tn{E&h1FYSp2_V@~_s}E^^s$G|-728v4DI0YMvqa+>G=$2Q#BHEVmWO7xg|rvbJ(^!+u!j7Qiqb^{QOFMPiwrCy5qV_4$l~RkAMO`f6y^${9sME$VUxkO`b7d_eN(I1-n)kRT7S=b*Op|3grKzlLiesM`Y}t95X1g}st`dzLEwr~V)R7=9|6t}eee!DU{8a<>}qA6ReL%q!)i~Mp3N_DLxqMcx{n9_<kuxYIKKht60-{uFgV@mIDPO;CSWD3^sy9hh{F3s-}Xo5(=CA>M0|^z<ZxFNeO=&JXE5$~xPJ-O$&FD(%qYVRxgbKh<>IGVI>?thkADJg-NpC)af*~<?nE{P0f^J2|5v<k1Y`ji4JH<7F<KJyE@C{x0+NyG?hF@hz5Z}A*Z7(5p(Nl4{qX$k`iF0E_tHCieX)=u@BI6A=9$EeG4d;$;Sv}Suu9kcYygfz-02Vc)4tAp=hsIpq69<AH~BEzx{h81fw>4GCyXMP@XR(~hyX=TiEsl^yyIDJ08vf^k0^5kVUbJR23Z3NLyo!L)B%Jk`yB1$1`q>v8U`$I0)dSpR74v<9M3rl7P)~UPD4CFvJMnUXwHQb2tLSGm|p`D5Ox92nG=Z7fY4}@dlEui$s{cSia;MnWn=4R1iES=9y?eA0vjtC*f=K;2OVmbQP(8`%%TWkb~&MhsqP&(pj3dj(6bUKB_qDcKSCr7J11^l0CSPXO(<%w`gAix3Oq;Q_%6H;9%S9k4PX^9s&*ZUQ3wdb(9I1cfk5f#iw6p34s&rs`2qNRlDeQwjdf1lP$W|3=JJvm95|t9$R**9z9jB)OA)!DI9hdwwuo?jCX~Vr1?U3qkPSrv22{2aDkPyWN3z$IOh7`4S0X#1n8Gb!;()R@UAno!(dCnyqfEih;uR-uZg5-?bMTN-EbY&Tn;YDeyx5dph<c+4kA^y-Bxnuze-jEcr%)nva|2XL#1t)6)NXD_8H7q~jxtC*L}w9ma|66sVe;lTpumg9l|Ltx5_l*p+=Mc@dx3CsLqQzE9dZatl7i}&v;<0l3UiDyP>w3u!3}~}A&5|gn|*}=Q4xd)krRqy`V@6oJCG*{V<Oy8VPvbaY(PbL*RD&8A{2a<IYqb*MM30Yno}oK7*J4_s?;94xxoWaUk-mEWVqz4sGA#{a7G-uHw2qYAry6UgX8ii*_2+~gEKd2IHB-7rm5e&0j0n_l-$h?lafmv-z6oBWGLL+h+tfpL$kp!LQhJ#xe<W`2#5O=Dsys8y18MDw!;#!08hXWmlh=ir5D@->TsYynuv61QG~*bs~{|Oy8<^9hPV!Wh^eRG0=Tp&KoMXdAr2Q0cOB6hIiWzygPPyuA!Cf=nFlvFLW1tb=6Eqq!3;&An;Q%y)SQW4hk{vW&X2jFK(7ghH;zmC@MX-+4e*teq>k|d7V<!FH#ay)fMkxoB6y*waC1ZAjnyuR0v82_OuD%tDTGxHFJ<msySZTw{nAaV$AJd$4I(!;B3ve84o@BoIVf%A<_5@U6gYwgj`w!s0e3f41m2B9M}c;V@FpA=H>e+Q^a3^|isQwJiaWI^K*4;V(WbWH&>4$}Q;Sj`CLcuT4k+B77t*OkDe8G89J7+k0KAvbsYL-QWQqtE6gVlN;%;sLLPS~`M7g;E!-d7jHlY;f5T6P+H#i<Ic6^t>D!xieH#fj(hpDnDQFza+fMCka4Pl%|M_-_!xKPT?4M`$!H<$woMiH3d<_5&@q026dP{L@@z|9Tt8x##U^&!|3ysw_Pxq<7UVc?(;6K)~IadQLQ9+0U`>mUS$xF>LG(GX_}DA@8?IdDUP)sC2h^H|DEQl}OTeS!yJ9kByC`QZ3EwP@(m0A$C-4KOI^i!e77x(<$+Vs<jZK)SgBHdMOomn0!x0UEiv0rNiqpK}w6!e9k7a&rR@uDRq;g3$xkD>pa5+Ccc@=nH16l00y8Loh7LyD1xz0pA57Zf*#eCq$9bB@s6_AWQ)kZ`w+UaXEy<Zf<}B02*vlM@b02!TN@7Zh$)nli2|k1(=w{+}wb;oe)R-1xgg=D{*R3=7ath$}yM0hDvY`6mdi0pr9Z1tUt1syW7Q7Tvpw-nELB7j55N^!>i|Kpu9bs_=k(L^L6AU;=lGMxMs>bOmo@8gUMR!E|Z#Tm{JLZJ-WkVtyH%w!AndijfLnWAkH1aHSH1ssw3iMbf^gV@eGTE_W!!_MV1sNoWSy_SiNwupuOMToR1%s&APb%*qaRo4_?m_fLjF%oEJ|$LO=>2QV5wWBLt>ra4;cQ?%wNYJzAw^J_^6KjPWv{3<qH$CsuA&Y3*k_kPDg+y~zb!GX5|!3-gb5`Qpj)1jJTyKx<2!dauVOcfI3v2Ra_jCcd*dgbdIPG=Do!Yglet^-Tg9ZjhFMn)J>ey+T6|JPqy#CGBNEG4Q_Dc-}is`!FiF&zbhkw0r*QMf<eAxz&Gzd1EIk(ct-XbTeThYO+qZ*NnSCx7qE)RH;CAA}Z^iJ<H_{<DU`ZElgS%>07h;J?iyuJ$ouFE29shYn%Xyp$E(4W_`0iv)rixRe<{w)BF=24D!66ybqAR*vsOcUV@eN2N7ye#`+vvvzcRWHsd5Qc>N_g2P8(A<Ucn-I1ez>Y70T;fGqrr8(z)v2u2Zz)YE3FZ}rEChgI0$`B`>%Zn2c~g`s7s+-0*)zUPSJ8F%kY9$|L|LWY}1@N3tr?L$<3ovOO`o8Nd&3^4Zq4s*o}&<f0d{g>COIX?*E5MoYze;M;oTfFm)&Un{)ck(V*8}CqWz^}f^lESKeIxQgs^buP5zZGBiAb2O1BPQRWGglE+j05=Ml=CkghyTnIDlU5OFdG17T&tuzQ+)6+eme=mZSJN$6<SVSs)ysL&JT~`$#5re5O^?!3j({@0;L4Ts{7jljyK>Eb9>HCwgB5lk;&OP$QHz$&`yVTnn5=ZO%``WQ*{+<CRB7(*o(S^MPFhIkUqssX#O{`1*Si)kRN|bTi~XIa9b_(7dHafm*OFYb^kYv0DKUGcrzq_Un2lya0n1N|3@_fz<>y+ll<El0q9OqZfZjR&octtCyaz4?*F&(TB~?!kCA1Vb2_^3r{mEOL);2zDe<PkIdrlPwpaRG>0J?JovQ##D4(O*vKdd_IGupv_VSWMCHk94v#4c~<MKqY_b<l@o*4INu%5_<*>1h@U@-n*f@K?odDA!rW_ty&&TMLuk2)IL!C-bVQ+Mp)`4_Nvi<YdlNS*ECeVOAK=FB#h56y7TQV3;Zut5KD&zJ9juEF?W{-OXhk1C64xXZUNp0i04^SD+XZ)WcL-ZMO2h?Ws+F5!K8Xsa`=H$v6UV0?RGtt9@0Ytqd?HHj*w=QYPY(`^$56n?Xy&Ak7nwMN;=zx+320dub'
GIT_API_B85 = 'c-p;`+m6~W5QbkR@@;{{IXby2D%+|DKwVL-psLWsb`rCRgJP$<u;Sf2DMH#_R9e(kuWV-y-^@RDo`|V{WF!|!$f!rdkOiCraEQay4+6$=!C4}G4h19<$cX4x$gL6>^lp3qFk6265<G-yJN^9O)BWQ3HJq=ekBb?u{$jVjd%s(+*4}dU@i;%0;kvoqEoY*hH;Zc1+ytAu8_d{uHD;@<-J8sHVXr2ovQ?i?c-y$0+_%Ps298Smo||`|bl2MPzU?g3E_%A?)+lS-E1IZmQ*Zy|K4bosb|zf|g5FkbN3tiPp^=EY<VKrpKn)epfTaOV1NP=(eA^q@nTc+(`}*)q4vZ3DhdjRL$7AY^X|VE=EMgf=HsmxS=Mt^_pG@0HIpEHB$qQ2vM@0mT`cWDew1|qFrnrERs8`PXB4na?g~<<K<GvV(r8d$SD2HaII2oy};@F#mTSq<uw@!ijNa5T@jzAsSLxVm}E(?^!`6)Y99F#7dUh@iciH`d|uN8OlgOvt5+Czr{hGgF_a)defoTW5MlOPSH0GT9=(?oI~{5Td&<PfJ6UhyGZf&90J@M6&E$B6t^Z;)HHdblm;v&2710kx4M(n&CbiS*j2Qln)=h7H)h!-?s>t_Oh+bqnHhyd>FzJ%2i#egUn#ky!'
PUBLIC_LOG = zlib.decompress(base64.b85decode(PUBLIC_LOG_B85))
GIT_API = json.loads(zlib.decompress(base64.b85decode(GIT_API_B85)))


class ActualProviderGuards(unittest.TestCase):
    def control(self):
        return [copy.deepcopy(CONFIG['run']), copy.deepcopy(CONFIG['jobs']),
                copy.deepcopy(CONFIG['artifact']), PUBLIC_LOG,
                {'object': {'sha': CONFIG['publisher']}}, copy.deepcopy(GIT_API)]

    def assert_good(self, values):
        audit.assert_provider(CONFIG, *values)

    def test_actual_complete_provider_control(self):
        self.assertEqual(len(PUBLIC_LOG), 174630)
        self.assertEqual(hashlib.sha256(PUBLIC_LOG).hexdigest(),
                         '10fb6338dd7fe70358bad49e2ee4ff96bc74f3440bf5d0868a4aaef9d32d4c2e')
        self.assert_good(self.control())
        self.assertEqual(CONFIG['siteFiles'], 1957)
        self.assertEqual(CONFIG['siteBytes'], 633671648)

    def test_reject_original_run_identity_and_failure_waivers(self):
        mutations = {'id': CONFIG['sourceReview']['runId'], 'head_sha': CONFIG['sourceCommit'],
                     'head_branch': 'audit/fake', 'path': CONFIG['workflow'], 'event': 'workflow_dispatch',
                     'run_attempt': 2, 'status': 'in_progress', 'conclusion': 'success'}
        for key, value in mutations.items():
            with self.subTest(key=key):
                values = self.control()
                values[0][key] = value
                with self.assertRaises(ValueError):
                    self.assert_good(values)

    def test_every_actual_public_route_decode_save_and_http_step_is_required(self):
        for number in range(7, 17):
            for conclusion in ['failure', 'skipped', 'cancelled']:
                with self.subTest(number=number, conclusion=conclusion):
                    values = self.control()
                    job = next(j for j in values[1] if j['id'] == CONFIG['publicLog']['id'])
                    next(s for s in job['steps'] if s['number'] == number)['conclusion'] = conclusion
                    with self.assertRaises(ValueError):
                        self.assert_good(values)

    def test_reject_other_failure_or_changed_complete_job_cohort(self):
        for mutation in ['failure_name', 'failure_number', 'extra_failure', 'missing_job', 'duplicate_job', 'wrong_attempt']:
            with self.subTest(mutation=mutation):
                values = self.control()
                job = next(j for j in values[1] if j['id'] == CONFIG['publicLog']['id'])
                step = next(s for s in job['steps'] if s['number'] == 17)
                if mutation == 'failure_name': step['name'] = 'Actual public route failed'
                if mutation == 'failure_number': step['number'] = 16
                if mutation == 'extra_failure': job['steps'][0]['conclusion'] = 'failure'
                if mutation == 'missing_job': values[1].pop(0)
                if mutation == 'duplicate_job': values[1].append(copy.deepcopy(job))
                if mutation == 'wrong_attempt': job['run_attempt'] = 2
                with self.assertRaises(ValueError):
                    self.assert_good(values)

    def test_complete_log_truncation_corruption_and_substitution(self):
        for data in [PUBLIC_LOG[:-1], b'ValueError: Verification packet exceeds bounded transport budget',
                     bytes([PUBLIC_LOG[0] ^ 1]) + PUBLIC_LOG[1:]]:
            with self.subTest(bytes=len(data)):
                values = self.control()
                values[3] = data
                with self.assertRaises(ValueError): self.assert_good(values)

    def test_exact_full_artifact_and_public_origin(self):
        mutations = [('id', 1), ('name', 'source-proof'), ('size_in_bytes', 796719990),
                     ('digest', 'sha256:' + '0' * 64), ('expired', True)]
        for key, value in mutations:
            with self.subTest(key=key):
                values = self.control()
                values[2][key] = value
                with self.assertRaises(ValueError): self.assert_good(values)
        for key, value in [('id', CONFIG['sourceReview']['runId']), ('head_sha', CONFIG['sourceCommit']),
                           ('head_branch', CONFIG['branch']), ('repository_id', 1)]:
            with self.subTest(origin=key):
                values = self.control()
                values[2]['workflow_run'][key] = value
                with self.assertRaises(ValueError): self.assert_good(values)

    def test_frozen_git_parent_tree_and_unchanged_main(self):
        for mutation in ['main', 'sha', 'tree', 'parent', 'extra_parent']:
            with self.subTest(mutation=mutation):
                values = self.control()
                if mutation == 'main': values[4]['object']['sha'] = '0' * 40
                if mutation == 'sha': values[5]['sha'] = CONFIG['sourceCommit']
                if mutation == 'tree': values[5]['tree']['sha'] = '0' * 40
                if mutation == 'parent': values[5]['parents'][0]['sha'] = '0' * 40
                if mutation == 'extra_parent': values[5]['parents'].append({'sha': '0' * 40})
                with self.assertRaises(ValueError): self.assert_good(values)


class TransportIdentityGuards(unittest.TestCase):
    def env(self):
        return {'GITHUB_ACTIONS': 'true', 'GITHUB_REPOSITORY': CONFIG['repository'],
                'GITHUB_EVENT_NAME': 'push', 'GITHUB_REF': 'refs/heads/' + CONFIG['branch'],
                'GITHUB_RUN_ATTEMPT': '1', 'GITHUB_SHA': 'a' * 40, 'GITHUB_RUN_ID': '99999999999'}

    def test_actual_push_transport_is_distinct_from_public_identity(self):
        with mock.patch.dict(os.environ, self.env(), clear=True):
            transport = audit.transport_identity(CONFIG)
        self.assertEqual(transport['runAttempt'], 1)
        self.assertEqual(transport['runURL'], 'https://github.com/amazin20/brainrot-portal/actions/runs/99999999999')
        self.assertEqual(audit.public_identity(CONFIG)['publicationRun'], 38366134401)
        self.assertNotEqual(transport['commit'], CONFIG['publisher'])

    def test_wrong_branch_repo_event_attempt_or_missing_runner(self):
        for key, value in [('GITHUB_ACTIONS', 'false'), ('GITHUB_REPOSITORY', 'other/repo'),
                           ('GITHUB_EVENT_NAME', 'workflow_dispatch'), ('GITHUB_REF', 'refs/heads/main'),
                           ('GITHUB_RUN_ATTEMPT', '2'), ('GITHUB_SHA', 'A' * 40), ('GITHUB_RUN_ID', '0')]:
            with self.subTest(key=key):
                env = self.env(); env[key] = value
                with mock.patch.dict(os.environ, env, clear=True), self.assertRaises(ValueError):
                    audit.transport_identity(CONFIG)

    def test_source_and_original_public_cannot_be_rescue_producer(self):
        for key, values in [('GITHUB_RUN_ID', [str(CONFIG['publicationRun']), str(CONFIG['sourceReview']['runId'])]),
                            ('GITHUB_SHA', [CONFIG['publisher'], CONFIG['sourceCommit']])]:
            for value in values:
                with self.subTest(key=key, value=value):
                    env = self.env(); env[key] = value
                    with mock.patch.dict(os.environ, env, clear=True), self.assertRaises(ValueError):
                        audit.transport_identity(CONFIG)

    def test_cross_origin_redirect_strips_token(self):
        request = audit.urllib.request.Request('https://api.github.com/repos/owner/repo/actions/artifacts/1/zip',
                                             headers={'Authorization': 'Bearer test-token'})
        redirect = audit.SafeRedirect().redirect_request(request, None, 302, 'Found', {}, 'https://objects.example.test/proof.zip')
        self.assertFalse(redirect.has_header('Authorization'))


class TinySelectionFixtureGuards(unittest.TestCase):
    """These few-byte files are selection fixtures, never actual PUBLIC evidence."""
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = pathlib.Path(self.temporary.name)
        self.source_files = [{'path': 'source.json', 'bytes': 2, 'sha256': audit.sha(b'{}')},
                             {'path': 'package.json', 'bytes': 2, 'sha256': audit.sha(b'{}')}]
        self.jobs = []
        for index in range(6):
            name = 'job-logs/' + str(index) + '.log'
            self.write(name, b'fixture-source-log')
            self.jobs.append({'rawLog': {'path': name, 'bytes': 18, 'sha256': audit.sha(b'fixture-source-log')}})
        self.write('package-binding.json', json.dumps({'artifacts': {'source': {'files': self.source_files}}, 'jobs': self.jobs}).encode())
        self.write('public-native/evidence.json', b'{"video":{"filename":"tower41-native.mp4"}}')
        self.write('public-foundation20/foundation20-native-report.json', b'{"video":{"filename":"foundation20-physical.mp4"}}')
        for row in self.source_files: self.write('review-artifacts/source/' + row['path'], b'{}')

    def write(self, name, data):
        file = self.root / name
        file.parent.mkdir(parents=True, exist_ok=True); file.write_bytes(data)

    def test_complete_core_both_movies_source_inputs_six_logs_and_preflight(self):
        names = audit.closure(CONFIG, HELPER, self.root)
        required = {'manifest.json', 'package-binding.json', 'public-bytes.json', 'baseline-manifest.json', 'predeploy-public-bytes.json',
                    'public-native/evidence.json', 'public-native/camera-observation.json', 'public-native/tower41-native.mp4',
                    'public-foundation20/foundation20-native-report.json', 'public-foundation20/foundation20-native-camera.json',
                    'public-foundation20/foundation20-telemetry.jsonl', 'public-foundation20/foundation20-native-pixels.log',
                    'public-foundation20/foundation20-physical.mp4',
                    'review-artifacts/native-foundation20/foundation20-native-report.json', 'review-artifacts/native-foundation20/binding.json',
                    'review-artifacts/native-foundation20/foundation20-native-camera.json', 'review-artifacts/native-foundation20/foundation20-telemetry.jsonl',
                    'review-artifacts/source/source.json', 'review-artifacts/source/package.json'}
        required.update(job['rawLog']['path'] for job in self.jobs)
        required.update({'github-guard-prepare.json', 'github-guard-deploy.json', 'downloaded-inputs.json', 'recovery-failed-provider.json'})
        self.assertEqual(set(names), required)
        self.assertEqual(names, sorted(set(names)))

    def test_exact_current_sidecars_include_real_names_exclude_recursive_or_prefix_substitutes(self):
        exact = {'github-guard-prepare.json', 'github-guard-deploy.json', 'downloaded-inputs.json', 'recovery-failed-provider.json'}
        excluded = {'review-artifacts/accepted-publication/manifest.json', 'review-artifacts/native-castle/camera-observation.json',
                    'downloads/old-proof.json', 'guard-substitute.json', 'download-substitute.json', 'recovery-substitute.json',
                    'recovery-inspected-deployments-prepare.json', 'recovery-final-inspected-deployments-deploy.json'}
        for name in exact | excluded: self.write(name, b'{}')
        names = set(audit.closure(CONFIG, HELPER, self.root))
        self.assertTrue(exact <= names, exact - names)
        self.assertFalse(excluded & names, excluded & names)

    def test_source_log_drift_blocks_selection(self):
        self.write('job-logs/0.log', b'changed')
        with self.assertRaises(ValueError): audit.closure(CONFIG, HELPER, self.root)

    def test_substitute_movie_traversal_and_wrong_extension(self):
        for name in ['../source.mp4', 'folder/source.mp4', 'source.webm', 'source.mp4/extra', 'source\\movie.mp4']:
            with self.subTest(name=name):
                self.write('public-native/evidence.json', json.dumps({'video': {'filename': name}}).encode())
                with self.assertRaises(ValueError): audit.closure(CONFIG, HELPER, self.root)

    def test_ambiguous_source_identity_member_blocks(self):
        self.source_files.append({'path': 'another/source.json', 'bytes': 2, 'sha256': audit.sha(b'{}')})
        self.write('package-binding.json', json.dumps({'artifacts': {'source': {'files': self.source_files}}, 'jobs': self.jobs}).encode())
        with self.assertRaises(ValueError): audit.closure(CONFIG, HELPER, self.root)


class TinySafeZipFixtureGuards(unittest.TestCase):
    def archive(self, members):
        stream = io.BytesIO()
        with warnings.catch_warnings(), zipfile.ZipFile(stream, 'w', compression=zipfile.ZIP_STORED) as archive:
            warnings.simplefilter('ignore', UserWarning)
            for name, data in members: archive.writestr(name, data)
        return stream.getvalue()

    def entries(self, raw, maximum=2_000_000_000):
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            entries = HELPER.zip_entries(archive, maximum)
            for entry, _, directory in entries:
                if not directory: archive.read(entry)  # reads all bytes and checks CRC
            return entries

    def test_small_zip_transport_control_no_public_acceptance(self):
        self.assertEqual(len(self.entries(self.archive([('manifest.json', b'{}')]))), 1)

    def test_traversal_backslash_duplicate_and_file_directory_collision(self):
        for members in [[('../outside', b'a')], [('a\\b', b'a')], [('/absolute', b'a')],
                        [('a', b'a'), ('a', b'b')], [('a', b'a'), ('a/b', b'b')]]:
            with self.subTest(members=members), self.assertRaises(ValueError): self.entries(self.archive(members))

    def test_symlink_and_special_file_rejected(self):
        for mode in [stat.S_IFLNK, stat.S_IFIFO, stat.S_IFSOCK]:
            info = zipfile.ZipInfo('member'); info.create_system = 3; info.external_attr = (mode | 0o644) << 16
            with self.subTest(mode=mode), self.assertRaises(ValueError): self.entries(self.archive([(info, b'target')]))

    def test_complete_crc_and_expanded_limit(self):
        raw = self.archive([('member', b'fixture-payload')])
        position = raw.index(b'fixture-payload')
        changed = raw[:position] + bytes([raw[position] ^ 1]) + raw[position+1:]
        with self.assertRaises(zipfile.BadZipFile): self.entries(changed)
        with self.assertRaises(ValueError): self.entries(raw, maximum=2)

    def test_inventory_refuses_auxiliary_symlink_and_counts_all_regular_bytes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary); (root / 'member').write_bytes(b'{}')
            rows = HELPER.inventory(root, 10)
            self.assertEqual(rows, [{'path': 'member', 'bytes': 2, 'sha256': audit.sha(b'{}')}])
            (root / 'link').symlink_to(root / 'member')
            with self.assertRaises(ValueError): HELPER.inventory(root, 10)


class RestoreSealMutationGuards(unittest.TestCase):
    """Injected tiny transport fixture stops before any semantic/site acceptance."""
    def fixture(self, root):
        original = root / 'original-proof'; original.mkdir()
        (original / 'unselected.bin').write_bytes(b'explicit-transport-fixture')
        archive = root / 'original-full-proof.zip'
        with zipfile.ZipFile(archive, 'w') as zipped:
            zipped.write(original / 'unselected.bin', 'unselected.bin')
        config = copy.deepcopy(CONFIG)
        config['artifact']['size_in_bytes'] = archive.stat().st_size
        config['artifact']['digest'] = 'sha256:' + audit.sha(archive.read_bytes())
        env = TransportIdentityGuards().env()
        with mock.patch.dict(os.environ, env, clear=True): producer = audit.transport_identity(config)
        rows = HELPER.inventory(original, 2_000_000_000)
        receipt = {'kind': 'exact-R5-read-only-full-proof-restore', 'pass': True,
                   **audit.public_identity(config), 'publicationRunAttempt': 1, 'originalCIConclusion': 'failure',
                   'transportProducer': producer, 'artifact': config['artifact'],
                   'archiveBytes': archive.stat().st_size, 'archiveSha256': audit.sha(archive.read_bytes()),
                   'files': rows, 'filesSha256': HELPER.inventory_sha256(rows), 'allMemberCRCChecked': True,
                   'nestedArchivePayloadsAudited': False, 'newDeployment': False, 'newRouteCapture': False}
        return config, env, receipt

    def test_unchanged_seal_reaches_selection_without_claiming_fixture_acceptance(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary); config, env, receipt = self.fixture(root)
            (root / 'restore-receipt.json').write_text(json.dumps(receipt))
            sentinel = RuntimeError('Explicit fixture stops before semantic/site acceptance')
            with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(audit, 'closure', side_effect=sentinel) as closure:
                with self.assertRaisesRegex(RuntimeError, 'fixture stops'):
                    audit.packet(config, HELPER, root, root / 'packet')
                closure.assert_called_once()

    def test_changed_unselected_member_deleted_extra_or_changed_archive_blocks_before_selection(self):
        for mutation in ['member', 'deleted', 'extra', 'archive', 'receipt_hash', 'receipt_archive_bytes']:
            with self.subTest(mutation=mutation), tempfile.TemporaryDirectory() as temporary:
                root = pathlib.Path(temporary); config, env, receipt = self.fixture(root)
                if mutation == 'member': (root / 'original-proof/unselected.bin').write_bytes(b'changed')
                if mutation == 'deleted': (root / 'original-proof/unselected.bin').unlink()
                if mutation == 'extra': (root / 'original-proof/extra.bin').write_bytes(b'extra')
                if mutation == 'archive': (root / 'original-full-proof.zip').write_bytes(b'changed')
                if mutation == 'receipt_hash': receipt['filesSha256'] = '0' * 64
                if mutation == 'receipt_archive_bytes': receipt['archiveBytes'] += 1
                (root / 'restore-receipt.json').write_text(json.dumps(receipt))
                with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(audit, 'closure') as closure:
                    with self.assertRaises(ValueError): audit.packet(config, HELPER, root, root / 'packet')
                    closure.assert_not_called()

    def test_historical_identity_transport_producer_and_honesty_flags_cannot_change(self):
        mutations = [('kind', 'source-capture'), ('publicationRun', CONFIG['sourceReview']['runId']),
                     ('publisherCommit', CONFIG['sourceCommit']), ('sourceCommit', '0' * 40),
                     ('publicationRunAttempt', 2), ('originalCIConclusion', 'success'),
                     ('allMemberCRCChecked', False), ('nestedArchivePayloadsAudited', True),
                     ('newDeployment', True), ('newRouteCapture', True), ('transportProducer', {})]
        for key, value in mutations:
            with self.subTest(key=key), tempfile.TemporaryDirectory() as temporary:
                root = pathlib.Path(temporary); config, env, receipt = self.fixture(root)
                receipt[key] = value
                (root / 'restore-receipt.json').write_text(json.dumps(receipt))
                with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(audit, 'closure') as closure:
                    with self.assertRaises(ValueError): audit.packet(config, HELPER, root, root / 'packet')
                    closure.assert_not_called()


class ReadOnlyDeploymentLeaseGuards(unittest.TestCase):
    """Tiny API fixtures test the lease boundary, not actual deployment success."""
    def lease(self, rows, statuses):
        with mock.patch.object(audit, 'provider_json', side_effect=[rows, statuses]):
            return audit.latest_deployment(CONFIG)

    def row(self): return {'id': 100, 'sha': CONFIG['publisher']}
    def status(self):
        return {'id': 200, 'state': 'success',
                'log_url': 'https://github.com/amazin20/brainrot-portal/actions/runs/38366134401/job/115192507489'}

    def test_only_exact_authenticated_original_run_is_leased_without_relabelling_ci(self):
        receipt = self.lease([self.row()], [self.status()])
        self.assertEqual(receipt['originalCIConclusion'], 'failure')
        self.assertEqual(receipt['deployment']['sha'], CONFIG['publisher'])

    def test_no_fallback_to_older_success_when_newer_unknown_row_exists(self):
        for state in ['success', 'failure', 'error', 'inactive', 'pending']:
            with self.subTest(state=state):
                new = {'id': 101, 'sha': CONFIG['sourceCommit']}; status = self.status(); status['state'] = state
                with self.assertRaises(ValueError): self.lease([self.row(), new], [status])

    def test_wrong_run_boundary_host_or_missing_status_rejected(self):
        for url in ['https://github.com/amazin20/brainrot-portal/actions/runs/383661344010/job/1',
                    'https://github.com/amazin20/brainrot-portal/actions/runs/38348119403/job/1',
                    'https://evil.example/actions/runs/38366134401/job/1']:
            with self.subTest(url=url):
                status = self.status(); status['log_url'] = url
                with self.assertRaises(ValueError): self.lease([self.row()], [status])
        with self.assertRaises(ValueError): self.lease([self.row()], [])


if __name__ == '__main__':
    unittest.main(verbosity=2)
