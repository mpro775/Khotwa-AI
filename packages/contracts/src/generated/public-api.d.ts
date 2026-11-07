export interface paths {
    "/api/v1/bootstrap": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * تهيئة الواجهة والحصول على رمز CSRF والقدرات المدعومة
         * @description نقطة دخول من نفس الأصل. تُصدر رمز CSRF مرتبطًا بملف ارتباط موقّع منفصل، ولا تُصدر صلاحية طالب بحد ذاتها. لا تُخزن الاستجابة في ذاكرة مشتركة.
         */
        get: operations["getBootstrap"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * بدء تجربة ضيف دون بيانات شخصية
         * @description إنشاء جلسة ضيف عبر Cookie HttpOnly Secure SameSite وفق قرار الأمان. يرفض الخادم Origin غير المعتمد وContent-Type غير JSON. إذا وُجدت جلسة صالحة تعاد 200 ولا تنشأ جلسة موازية بالخطأ.
         */
        post: operations["createGuestSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/guest-sessions/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** قراءة حالة جلسة الضيف الحالية */
        get: operations["getCurrentGuestSession"];
        put?: never;
        post?: never;
        /**
         * إبطال جلسة الضيف ومسح الكوكي
         * @description إبطال رمز الدخول يختلف عن محو بيانات التعليم؛ سياسة الحذف والاحتفاظ تُعتمد في 16-SECURITY-PRIVACY.md.
         */
        delete: operations["revokeGuestSession"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** إنشاء جلسة تعلم وربطها بحزمة محتوى منشورة */
        post: operations["createLearningSession"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning-sessions/{learningSessionId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** قراءة جلسة تعلم يملكها الضيف */
        get: operations["getLearningSession"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/skills": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** قائمة المهارات المدعومة المنشورة */
        get: operations["listSkills"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/skills/{skillId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** تفاصيل مهارة من محتوى منشور */
        get: operations["getSkill"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/problems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * قائمة المسائل المنشورة والمسموحة للمسار
         * @description تعرض فقط مسائل kind=main المنشورة القابلة للبدء من الكتالوج؛ لا تكشف مسألة نقل أو علاج غير مسندة، حتى لو عُرف معرفها.
         */
        get: operations["listProblems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/problems/{problemId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * قراءة المسألة المنشورة دون تسريب الحل المرجعي
         * @description قراءة kind=main المنشورة، أو مسألة علاج/نقل مُسندة فعليًا لجلسة المالك فقط؛ 404 عند محاولة اكتشاف مسألة نقل قبل الإسناد.
         */
        get: operations["getProblem"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** سرد محاولات جلسة تعلم مملوكة */
        get: operations["listAttempts"];
        put?: never;
        /**
         * بدء محاولة رئيسية أو مرتبطة بإسناد تربوي
         * @description المحاولة من الكتالوج مسموحة فقط لمسائل main؛ يجب أن يعود problemRevisionId إلى محتوى منشور وموافق لحزمة الجلسة. عند source.kind=assignment تُثبت الملكية وسياسة المساعدة والنسخة من الخادم.
         */
        post: operations["createAttempt"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * قراءة الخطوات النشطة والحكم الحالي فقط
         * @description قد توجد نتائج تاريخية محفوظة بالقاعدة، لكنها لا تُعرض على أنها صحيحة للحالة الحالية عند تغير النسخ.
         */
        get: operations["getAttempt"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/steps": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** إضافة خطوة بنسخة أولى وحفظ مصدرها العربي */
        post: operations["createStep"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/steps/{stepId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /**
         * تحرير خطوة بإضافة نسخة لا باستبدال التاريخ
         * @description يرتفع attempt.revision ذريًا وتبطل نتائج الانتقال المتأثر واللاحق والتشخيصات والتلميحات المبنية عليه.
         */
        put: operations["updateStep"];
        post?: never;
        /** حذف خطوة منطقيًا وإبطال النتائج التابعة */
        delete: operations["deleteStep"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * تحقق من انتقال محدد أو سلسلة الحل الحالية
         * @description scope=target_edge يتطلب targetStepId غير null؛ scope=current_sequence يتطلب targetStepId=null ويتحقق من التسلسل قبل إكمال المحاولة. استجابة HTTP 200 تشمل syntax_error/unsupported/inconclusive بوصفها أحكام المحرك. عطل Python ينتج 503 دون احتساب خطأ تعليمي. نتيجة قديمة بعد تعديل خطوة تُرفض 409.
         */
        post: operations["verifyAttempt"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/verifications/{verificationResultId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * قراءة دليل تحقق مع تحديد صلاحيته للنسخة الحالية
         * @description لا يعتمد التاريخ كحكم جارٍ؛ يوضح isCurrent حالة النسخ حين القراءة.
         */
        get: operations["getVerificationResult"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/probes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * اقتراح سؤال تأكيدي من نتيجة خطأ مثبتة
         * @description لا يولد سؤالًا تشخيصيًا بسبب syntax_error/unsupported/inconclusive/service_error. الاستجابة لا تكشف الحل الصحيح للسؤال.
         */
        post: operations["createDiagnosticProbe"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/probes/{probeId}/responses": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** تسجيل إجابة سؤال التأكيد وإعادة تقييم الفرضية */
        post: operations["answerDiagnosticProbe"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/hints": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * طلب تلميح تالٍ أو عرض حل كامل بتأكيد واضح
         * @description مستوى H0–H4 يحدده الخادم؛ show_full_solution مسموح فقط بنمط تعلم مناسب مع confirmAssistedCompletion=true، ويمنع إثبات نقل مستقل للمحاولة نفسها. عند فشل AI يستخدم قالبًا معتمدًا أو استجابة 503، ولا يغير الحكم الرياضي.
         */
        post: operations["requestHint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/remediation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * بدء حلقة تدريب على مهارة واحدة
         * @description يمكن أيضًا بدء التدريب من طلب الطالب دون تشخيص سلبي، ولا يُدعى وجود سبب مثبت عندما تكون الحالة unresolved.
         */
        post: operations["startRemediation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{attemptId}/transfer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * إسناد مسألة جديدة للتحقق من انتقال الفهم
         * @description يجب أن تكون الحلقة جاهزة، والمسألة جديدة لم تُكشف إجابتها، وسياسة المساعدة independent؛ إذا طلب الطالب مساعدة أثناء النقل يخرج إلى التعلم دون أن يحسب نجاحًا مستقلًا.
         */
        post: operations["startTransferCheck"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning-episodes/{episodeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** قراءة حالة حلقة التعلم والإسنادات الحالية */
        get: operations["getLearningEpisode"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * ملخص المهارات المستند إلى أدلة صالحة
         * @description لا تعني not_assessed صفرًا في المهارة؛ لا يُحسب مجرد مشاهدة حل كامل إتقانًا مستقلًا، ولا تستعمل نتائج تاريخية غير صالحة.
         */
        get: operations["getProgress"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/progress/skills/{skillId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** ملخص مهارة محددة لجلسة التعلم */
        get: operations["getSkillProgress"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher-demo/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * مؤشرات الفصل الاصطناعي المنفصل
         * @description لا تُقرأ جلسات طالب حقيقي. يجب أن تكون isSynthetic=true وأن تكون الأعداد مشتقة من حزمة تجريبية مصنفة ومعلنة، مع حارس وصول عبر جلسة ضيف.
         */
        get: operations["getTeacherDemoSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/teacher-demo/examples/{exampleId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * مثال خطأ اصطناعي مشروح
         * @description لا يمكن تغيير مصدر البيانات إلى جلسات مستخدمين حقيقيين عبر معامل أو معرّف من المتصفح.
         */
        get: operations["getTeacherDemoExample"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** فحص وجود خدمة NestJS داخليًا */
        get: operations["getNestLiveHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/internal/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** فحص جاهزية الاتصالات الحرجة داخليًا */
        get: operations["getNestReadyHealth"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** هوية الحساب وCSRF؛ لا يربط الضيف تلقائيًا */
        get: operations["product_api_v1_me_get"];
        put?: never;
        post?: never;
        /** طلب محو مع إبطال الوصول؛ لا يدعي المحو الفوري من النسخ */
        delete: operations["product_api_v1_me_delete"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/email/request": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** طلب OTP عبر بريد الخادم؛ رمز loginCsrfToken من GET me */
        post: operations["product_api_v1_auth_email_request_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/email/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** استهلاك OTP واحد وإصدار kh_account Secure HttpOnly */
        post: operations["product_api_v1_auth_email_verify_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** /api/v1/auth/logout */
        post: operations["product_api_v1_auth_logout_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/claim-guest": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** ربط الضيف الحالي فقط بعد موافقة صريحة؛ سجل provenance ومعاملة واحدة */
        post: operations["product_api_v1_me_claim_guest_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** /api/v1/me/attempts */
        get: operations["product_api_v1_me_attempts_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** /api/v1/me/progress */
        get: operations["product_api_v1_me_progress_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** /api/v1/me/export */
        get: operations["product_api_v1_me_export_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/beta/feedback": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** /api/v1/beta/feedback */
        post: operations["product_api_v1_beta_feedback_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/beta/metrics": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** مقاييس منقحة لمسؤول admin فقط */
        get: operations["product_api_v1_beta_metrics_get"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/beta/access/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** إيقاف حساب وإبطال جميع جلساته؛ admin فقط */
        post: operations["product_api_v1_beta_access_revoke_post"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/physics/problems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listPhysicsProblems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/physics/problems/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getPhysicsProblem"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/physics/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["submitPhysicsAnswer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/physics/attempts/{id}/hints": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["requestPhysicsHint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/physics/attempts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["resumePhysicsAttempt"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/items": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listStudioItems"];
        put?: never;
        post: operations["createStudioDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/items/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getStudioRevision"];
        put: operations["editStudioDraft"];
        post?: never;
        delete: operations["deleteStudioDraft"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/items/{id}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["validateStudioRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/items/{id}/transition": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description submit/revise للمحرر؛ approve/publish/archive/rollback للمشرف. النسخ المنشورة ثابتة، ويستلزم النشر تحقق المحرك ومراجعة المستخدم المخول. */
        post: operations["transitionStudioRevision"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/import/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["previewStudioImport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/import": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["importStudioDrafts"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/export": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["exportStudioContent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getProductCatalog"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/problems/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getPublishedProductProblem"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/problems/{id}/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["startPublishedStudioAlgebra"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/programming/problems": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listProgrammingProblems"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/programming/problems/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getProgrammingProblem"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/programming/attempts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["listProgrammingAttempts"];
        put?: never;
        post: operations["submitProgrammingCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/programming/attempts/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getProgrammingAttempt"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/programming/attempts/{id}/hints": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["getProgrammingHint"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{id}/tutoring-plan": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAdaptiveTutoringPlan"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/attempts/{id}/problem": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getAttemptPinnedProblem"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/ai-consent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** موافقة المساعد الخارجي الحالية للمالك فقط */
        get: operations["getAccountAiConsent"];
        put?: never;
        /** اختيار صريح منسوخ للموافقة أو سحبها؛ لا إذن لإرسال كود الطالب */
        post: operations["setAccountAiConsent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/learning-consent": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** موافقة رحلة التعلم الحقيقية المنسوخة؛ لا إذن لمزود خارجي */
        get: operations["getAccountLearningConsent"];
        put?: never;
        /** موافقة رحلة التعلم الحقيقية المنسوخة؛ لا إذن لمزود خارجي */
        post: operations["setAccountLearningConsent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/physics/attempts/{id}/learning": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get: operations["getPhysicsLearningLoop"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/physics/attempts/{id}/remediation": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["startPhysicsRemediation"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/physics/attempts/{id}/transfer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post: operations["startPhysicsTransfer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning/tracks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetLearningTracks"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning/tracks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetLearningTracksId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning/lessons/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetLearningLessonsId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning/skill-map": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetLearningSkillMap"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/learning-content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetStudioLearningContent"];
        put?: never;
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        post: operations["v22PostStudioLearningContent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/learning-content/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetStudioLearningContentId"];
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        put: operations["v22PutStudioLearningContentId"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/learning-content/{id}/validate": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        post: operations["v22PostStudioLearningContentIdValidate"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/learning-content/{id}/transition": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        post: operations["v22PostStudioLearningContentIdTransition"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/learning-bank": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetStudioLearningBank"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/studio/learning-content/seed": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description يستورد حزمة مسودات فقط؛ لا يصنع اعتمادا أو نشرا تلقائيا. */
        post: operations["v22PostStudioLearningContentSeed"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assessments/start": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        post: operations["v22PostAssessmentsStart"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assessments/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetAssessmentsId"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assessments/{id}/answer": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        post: operations["v22PostAssessmentsIdAnswer"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assessments/{id}/support": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description يسجل الخروج من القياس المستقل قبل طلب التلميح. H4 يتطلب تأكيدا صريحا. */
        post: operations["v22PostAssessmentsIdSupport"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/assessments/{id}/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetAssessmentsIdSummary"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/recommendations/next": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetRecommendationsNext"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning/lessons/{id}/progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** @description مشاهدة الدرس حدث فقط ولا تمنح دليل فهم مستقل. */
        post: operations["v22PostLearningLessonsIdProgress"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/learning/progress": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** @description مسارات V2.2؛ يظل المحتوى مسودة حتى مراجعة مخولة. النسخ السابقة مثبتة ولا تمنح معرفة UUID صلاحية. */
        get: operations["v22GetLearningProgress"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Meta: {
            /**
             * Format: uuid
             * @description معرّف تتبع الطلب.
             */
            requestId: string;
            /**
             * Format: date-time
             * @description وقت الاستجابة UTC.
             */
            serverTime: string;
            /**
             * @description إصدار الواجهة.
             * @example 1
             */
            apiVersion: string;
        };
        /**
         * @description نوع المسألة من نسخة المحتوى المنشورة.
         * @enum {string}
         */
        ProblemKind: "main" | "remediation" | "transfer" | "diagnostic";
        /**
         * @description حكم محرك الرياضيات؛ لا يساوي تشخيصًا تربويًا.
         * @enum {string}
         */
        MathStatus: "verified_valid" | "verified_invalid" | "syntax_error" | "unsupported" | "inconclusive" | "service_error";
        /**
         * @description حالة فرضية الخطأ، وليست حكمًا على الطالب.
         * @enum {string}
         */
        DiagnosisState: "tentative" | "needs_probe" | "supported_by_probe" | "rejected" | "unresolved";
        /** @enum {string} */
        AttemptKind: "main" | "probe" | "remediation" | "transfer";
        /** @enum {string} */
        AttemptStatus: "in_progress" | "completed" | "assisted_completed" | "stopped";
        /** @enum {string} */
        LearningEpisodeState: "proposed" | "probing" | "remediating" | "awaiting_transfer" | "finished" | "cancelled";
        /**
         * @description المساعدة من دون تلميح إلى الحل الكامل.
         * @enum {string}
         */
        HintLevel: "H0" | "H1" | "H2" | "H3" | "H4";
        /** @enum {string} */
        ProgressState: "not_assessed" | "needs_followup" | "practice_with_support" | "new_evidence_of_understanding";
        /**
         * @description التحقق من انتقال واحد أو السلسلة كاملة.
         * @enum {string}
         */
        VerificationScope: "target_edge" | "current_sequence";
        /** @description تمثيل دقيق للنسب؛ لا تستخدم float. */
        Rational: {
            /**
             * @description البسط العشري كنص صحيح موقع.
             * @example 2
             */
            num: string;
            /**
             * @description المقام العشري كنص صحيح موجب، ولا يساوي صفرًا.
             * @example 1
             */
            den: string;
        };
        MathSource: {
            /**
             * @description الصيغة العربية كما أدخلها الطالب دون استبدال صامت.
             * @example ٢س + ٦ = ١٠
             */
            sourceRaw: string;
            displayAr: string | null;
            /**
             * @description حالة التحليل البنيوي.
             * @enum {string}
             */
            parseStatus: "not_checked" | "parsed" | "syntax_error" | "unsupported" | "inconclusive";
        };
        MathIssue: {
            /** @description رمز ثابت مثل AMBIGUOUS_DIVISION. */
            reasonCode: string;
            /** @description رسالة عربية قابلة للعرض دون traceback. */
            messageAr: string;
            spanStart: number | null;
            spanEnd: number | null;
            /** @enum {string} */
            spanUnit: "unicode_codepoint";
            hintKey: string | null;
        };
        SolutionSet: {
            /**
             * @description مجموعة حل المعادلة الخطية ضمن الأعداد الحقيقية.
             * @enum {string}
             */
            kind: "singleton" | "all_reals" | "empty";
            value: components["schemas"]["Rational"] | null;
        };
        Counterexample: {
            /** @enum {string} */
            variable: "س";
            value: components["schemas"]["Rational"];
            satisfiesPrevious: boolean;
            satisfiesNext: boolean;
        };
        MathEvidence: {
            /** @enum {string} */
            kind: "counterexample" | "solution_set" | "rule_violation" | "none";
            /** @enum {string} */
            domain: "reals";
            previousSolution: components["schemas"]["SolutionSet"] | null;
            nextSolution: components["schemas"]["SolutionSet"] | null;
            witness: components["schemas"]["Counterexample"] | null;
            summaryAr: string | null;
        };
        DiagnosisCandidate: {
            diagnosisId: string | null;
            state: components["schemas"]["DiagnosisState"];
            errorCode: string | null;
            skillId: string | null;
            /** @description صياغة احتمالية، لا حكم قطعي. */
            explanationAr: string;
            needsProbe: boolean;
        };
        Capabilities: {
            /** @enum {string} */
            notationProfile: "ar-mashriq-school-v1";
            /** @enum {string} */
            subject: "algebra";
            /** @enum {string} */
            variable: "س";
            mathModes: "linear_one_variable"[];
            /** @default false */
            supportsTrigonometry: boolean;
            /** @default false */
            supportsHandwriting: boolean;
            /**
             * @description تفعيل الكسور يخضع لنجاح اختبارات العرض.
             * @default false
             */
            supportsFractions: boolean;
            /** @default false */
            supportsTeacherRealData: boolean;
            supportedMathStatuses: components["schemas"]["MathStatus"][];
        };
        BootstrapData: {
            /** @description رمز حماية ضد تزوير الطلبات، ليس رمز جلسة دخول. */
            csrfToken: string;
            /** @enum {string} */
            csrfHeaderName: "X-CSRF-Token";
            capabilities: components["schemas"]["Capabilities"];
            hasActiveGuestSession: boolean;
        };
        GuestSession: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "active" | "expired" | "revoked";
            /** Format: date-time */
            expiresAt: string;
            /** Format: date-time */
            createdAt: string;
        };
        GuestCreateData: {
            session: components["schemas"]["GuestSession"];
            /** @description رمز حماية جديد إن تم تدويره بعد إصدار الجلسة؛ يستبدل الرمز السابق. */
            csrfToken: string;
        };
        LearningSession: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "active" | "ended" | "abandoned";
            /** Format: uuid */
            releaseId: string;
            /** Format: date-time */
            startedAt: string;
            endedAt: string | null;
            /** @description تكون false دائمًا في جلسات الطلاب الحقيقيين. */
            isSynthetic: boolean;
        };
        Skill: {
            /** Format: uuid */
            id: string;
            /** @description كود ثابت مثل SK-ALG-03. */
            code: string;
            titleAr: string;
            objectiveAr: string;
            prerequisiteSkillIds: string[];
            /** Format: int32 */
            availableProblemCount: number;
            /** @enum {string} */
            availability: "available" | "unavailable";
        };
        ProblemSummary: {
            /**
             * Format: uuid
             * @description هوية المسألة الأساسية.
             */
            id: string;
            /**
             * Format: uuid
             * @description النسخة المنشورة المحددة.
             */
            revisionId: string;
            titleAr: string;
            kind: components["schemas"]["ProblemKind"];
            /** Format: uuid */
            skillId: string;
            /** Format: int32 */
            difficultyBand: number;
            notationProfile: string;
            /** Format: uuid */
            contentReleaseId: string;
        };
        /** @description لا تتضمن الحل المرجعي أو answer_spec أو بيانات الإجابة الصحيحة للطالب. */
        ProblemDetail: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            revisionId: string;
            /** Format: int32 */
            versionNumber: number;
            /** @description صياغة المسألة المعتمدة. */
            statementAr: string;
            /**
             * @description المعادلة العربية الأصلية الموثقة.
             * @example ٢(س + ٣) = ١٠
             */
            originalEquation: string;
            kind: components["schemas"]["ProblemKind"];
            /** Format: uuid */
            primarySkillId: string;
            notationProfile: string;
            /** Format: int32 */
            difficultyBand: number;
            /** Format: uuid */
            contentReleaseId: string;
        };
        Step: {
            /** Format: uuid */
            id: string;
            /**
             * Format: int32
             * @description ترتيب الطالب يبدأ من 1، ولا تشمل معادلة السؤال الأصلية.
             */
            position: number;
            /** Format: int32 */
            currentVersion: number;
            source: components["schemas"]["MathSource"];
            isActive: boolean;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @description مصدر الحقيقة للحالة الحالية؛ النتائج السابقة تبقى تاريخية ولا تُعد نتائج نشطة بعد التعديل. */
        Attempt: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            learningSessionId: string;
            /** Format: uuid */
            problemRevisionId: string;
            kind: components["schemas"]["AttemptKind"];
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            revision: number;
            status: components["schemas"]["AttemptStatus"];
            completionVerdict: ("verified_complete" | "not_complete" | "unknown") | null;
            notationProfile: string;
            steps: components["schemas"]["Step"][];
            /** Format: date-time */
            openedAt: string;
            /** Format: date-time */
            updatedAt: string;
            parentEpisodeId: string | null;
            currentVerification: components["schemas"]["VerificationReport"] | null;
        };
        StepMutationResult: {
            /** Format: uuid */
            attemptId: string;
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            attemptRevision: number;
            step: components["schemas"]["Step"] | null;
            /**
             * Format: int32
             * @description أول موقع يجب إعادة فحصه.
             */
            invalidatedFromPosition: number;
            /** Format: int32 */
            invalidatedVerificationCount: number;
        };
        TransitionVerdict: {
            /** Format: uuid */
            verificationResultId: string;
            from: {
                /** @enum {string} */
                kind: "problem" | "step";
                stepId: string | null;
                stepVersion: number | null;
            };
            to: {
                /** Format: uuid */
                stepId: string;
                /** Format: int32 */
                stepVersion: number;
            };
            mathStatus: components["schemas"]["MathStatus"];
            reasonCode: string | null;
            issue: components["schemas"]["MathIssue"] | null;
            evidence: components["schemas"]["MathEvidence"] | null;
            engineVersion: string;
            notationProfileVersion: string;
        };
        Completion: {
            /** @enum {string} */
            state: "not_complete" | "verified_complete" | "unknown";
            canMarkAttemptCompleted: boolean;
            explanationAr: string;
        };
        VerificationReport: {
            /**
             * Format: uuid
             * @description معرّف تشغيل التحقق.
             */
            id: string;
            /** Format: uuid */
            attemptId: string;
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            attemptRevision: number;
            /** Format: uuid */
            problemRevisionId: string;
            scope: components["schemas"]["VerificationScope"];
            /** @description يجب أن تكون true في استجابة ناجحة حديثة؛ القديمة تعاد 409. */
            isCurrent: boolean;
            transitions: components["schemas"]["TransitionVerdict"][];
            firstBlockingTransitionIndex: number | null;
            completion: components["schemas"]["Completion"];
            diagnosisCandidate: components["schemas"]["DiagnosisCandidate"] | null;
        };
        ProbeOption: {
            id: string;
            labelAr: string;
        };
        /** @description لا تُرسل الإجابة الصحيحة إلى الطالب قبل إرسال الإجابة. */
        Probe: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            attemptId: string;
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            attemptRevision: number;
            diagnosisId: string | null;
            questionAr: string;
            /** @enum {string} */
            responseMode: "choice" | "text";
            options: components["schemas"]["ProbeOption"][];
            /** @enum {string} */
            status: "open" | "answered" | "cancelled";
        };
        ProbeEvaluation: {
            /** Format: uuid */
            probeId: string;
            /** Format: uuid */
            attemptId: string;
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            attemptRevision: number;
            /** @enum {string} */
            evaluation: "supported" | "not_supported" | "unclear" | "unverified";
            diagnosis: components["schemas"]["DiagnosisCandidate"] | null;
            feedbackAr: string;
            /** @enum {string} */
            nextAction: "hint" | "remediation" | "continue" | "clarify";
        };
        TutoringEvent: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            attemptId: string;
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            attemptRevision: number;
            /** @enum {string} */
            eventType: "hint" | "full_solution" | "fallback" | "pause";
            hintLevel: components["schemas"]["HintLevel"];
            /** @description رسالة عربية مراجعة أو مولدة خاضعة للتصفية والتحقق. */
            textAr: string;
            solutionStepsAr: string[];
            /** @enum {string} */
            generationSource: "reviewed_template" | "llm_validated" | "manual";
            /** @description false عند عرض H4 أو الحل الكامل. */
            independentEvidenceEligible: boolean;
            /** Format: date-time */
            createdAt: string;
        };
        Assignment: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            episodeId: string;
            /** @enum {string} */
            phase: "probe" | "remediation" | "transfer";
            /** Format: uuid */
            problemRevisionId: string;
            problem: components["schemas"]["ProblemDetail"];
            /** @enum {string} */
            assistancePolicy: "guided" | "limited" | "independent";
            attemptId: string | null;
            /** Format: date-time */
            assignedAt: string;
        };
        LearningEpisode: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            rootAttemptId: string;
            /** Format: uuid */
            skillId: string;
            state: components["schemas"]["LearningEpisodeState"];
            assignments: components["schemas"]["Assignment"][];
            /** Format: date-time */
            createdAt: string;
            endedAt: string | null;
            /** @enum {string} */
            nextAction: "answer_probe" | "start_remediation" | "complete_remediation" | "start_transfer" | "review_progress" | "none";
        };
        SkillProgress: {
            /** Format: uuid */
            skillId: string;
            skillCode: string;
            titleAr: string;
            state: components["schemas"]["ProgressState"];
            /** Format: int32 */
            evidenceCount: number;
            /** Format: int32 */
            independentTransferCount: number;
            /** Format: int32 */
            assistedPracticeCount: number;
            updatedAt: string | null;
        };
        ProgressSummary: {
            /** Format: uuid */
            learningSessionId: string;
            isSynthetic: boolean;
            skills: components["schemas"]["SkillProgress"][];
            /** Format: date-time */
            updatedAt: string;
            /** @description نتائج دليل محدود، ليست شهادة إتقان نهائي. */
            noteAr: string;
        };
        TeacherDemoMetric: {
            code: string;
            titleAr: string;
            /** Format: int32 */
            count: number;
        };
        TeacherDemoSummary: {
            /**
             * @description ثابت true؛ ممنوع خلط بيانات الطلاب الحقيقية.
             * @example true
             * @constant
             */
            isSynthetic: true;
            datasetCode: string;
            /** Format: date-time */
            generatedAt: string;
            /** Format: int32 */
            sampleStudentCount: number;
            /** Format: int32 */
            sampleAttemptCount: number;
            metrics: components["schemas"]["TeacherDemoMetric"][];
            topMisconceptions: {
                errorCode: string;
                nameAr: string;
                /** Format: int32 */
                count: number;
            }[];
            exampleIds: string[];
            disclaimerAr: string;
        };
        TeacherDemoExample: {
            /** Format: uuid */
            id: string;
            /**
             * @description بيانات تركيبية فقط
             * @constant
             */
            isSynthetic: true;
            datasetCode: string;
            problem: components["schemas"]["ProblemDetail"];
            steps: components["schemas"]["Step"][];
            mathStatus: components["schemas"]["MathStatus"];
            diagnosis: components["schemas"]["DiagnosisCandidate"] | null;
            reviewNoteAr: string;
        };
        ListSkills: {
            items: components["schemas"]["Skill"][];
        };
        ListProblems: {
            items: components["schemas"]["ProblemSummary"][];
            nextCursor: string | null;
        };
        ListAttempts: {
            items: components["schemas"]["Attempt"][];
            nextCursor: string | null;
        };
        ServiceHealth: {
            /** @enum {string} */
            status: "ok" | "degraded" | "unavailable";
            service: string;
            /** Format: date-time */
            time: string;
            dependencies: {
                name: string;
                /** @enum {string} */
                state: "ok" | "unavailable";
            }[];
        };
        /** @description لا يحدد المتصفح حزمة أو نسخة سياسة؛ يختارها الخادم من محتوى منشور. */
        CreateLearningSessionInput: Record<string, never>;
        /** @description النسخة يثبتها الخادم من المحتوى المنشور أو الإسناد المعتمد. */
        CreateAttemptInput: {
            /** Format: uuid */
            learningSessionId: string;
            source: {
                /** @enum {string} */
                kind: "catalog";
                /** Format: uuid */
                problemRevisionId: string;
            } | {
                /** @enum {string} */
                kind: "assignment";
                /** Format: uuid */
                assignmentId: string;
            };
        };
        CreateStepInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
            /**
             * Format: int32
             * @description مكان جديد في نهاية التسلسل P0.
             */
            position: number;
            /** @description معادلة عربية؛ يسمح بحفظ مسودة غير مكتملة دون نسبة خطأ مفاهيمي. */
            sourceRaw: string;
            /** @enum {string} */
            inputOrigin: "keyboard" | "math_editor";
        };
        EditStepInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
            sourceRaw: string;
            /** @enum {string} */
            inputOrigin: "keyboard" | "math_editor";
        };
        DeleteStepInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
        };
        VerifyInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
            scope: components["schemas"]["VerificationScope"];
            targetStepId: string | null;
        } & (unknown & unknown);
        RequestProbeInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
            /**
             * Format: uuid
             * @description نتيجة حالية verified_invalid تحمل دليلًا مثبتًا.
             */
            verificationResultId: string;
        };
        ProbeAnswer: {
            /** @enum {string} */
            kind: "choice";
            optionId: string;
        } | {
            /** @enum {string} */
            kind: "text";
            textAr: string;
        };
        AnswerProbeInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
            answer: components["schemas"]["ProbeAnswer"];
        };
        /** @description لا يرسل العميل hintLevel؛ NestJS يفرض سياسة H0–H4 ووضع المهمة. */
        HintInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
            /** @enum {string} */
            action: "next_hint" | "show_full_solution";
            /**
             * @description يجب true عند show_full_solution، وإلا 422.
             * @default false
             */
            confirmAssistedCompletion: boolean;
        } & unknown;
        StartRemediationInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
        };
        StartTransferInput: {
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            expectedRevision: number;
            /** Format: uuid */
            episodeId: string;
        };
        /** @description إنشاء ضيف دون أسماء أو بريد أو هاتف. */
        CreateGuestInput: Record<string, never>;
        ValidationIssue: {
            /** @example body.expectedRevision */
            path: string;
            /** @example required */
            rule: string;
            messageAr: string;
        };
        ErrorDetail: {
            /**
             * @description رمز خطأ تطبيقي ثابت للمستهلك.
             * @enum {string}
             */
            code: "invalid_input" | "unauthenticated" | "forbidden" | "not_found" | "session_expired" | "revision_conflict" | "idempotency_conflict" | "request_in_progress" | "invalid_state" | "content_version_conflict" | "math_unsupported" | "math_inconclusive" | "math_unavailable" | "ai_unavailable" | "rate_limited" | "internal_error" | "csrf_invalid";
            messageAr: string;
            issues: components["schemas"]["ValidationIssue"][];
            currentRevision: number | null;
            retryable: boolean;
            retryAfterSeconds: number | null;
        };
        ErrorEnvelope: {
            error: components["schemas"]["ErrorDetail"];
            meta: components["schemas"]["Meta"];
        };
        /** @description نتيجة إثبات داخلية دون نصوص تعليمية مولدة. */
        InternalMathEvidence: {
            /** @enum {string} */
            type: "counterexample" | "solution_set" | "rule_violation" | "none";
            /** @enum {string} */
            domain: "reals";
            previousSolution: components["schemas"]["SolutionSet"] | null;
            nextSolution: components["schemas"]["SolutionSet"] | null;
            witness: components["schemas"]["Counterexample"] | null;
        };
        /** @description الوصول إلى نتيجة تاريخية لا يعني صلاحيتها للنسخة الحالية. */
        VerificationResultDetail: {
            /** Format: uuid */
            attemptId: string;
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            attemptRevision: number;
            isCurrent: boolean;
            result: components["schemas"]["TransitionVerdict"];
        };
        InternalMathContext: {
            /** Format: uuid */
            attemptId: string;
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            attemptRevision: number;
            /** Format: uuid */
            problemRevisionId: string;
            notationProfile: string;
            /** @enum {string} */
            domain: "reals";
        };
        InternalMathTransitionRequest: {
            /** @enum {string} */
            schemaVersion: "math-internal-v1";
            /** Format: uuid */
            requestId: string;
            context: components["schemas"]["InternalMathContext"];
            transition: {
                /** @enum {string} */
                fromKind: "problem" | "step";
                fromStepVersionId: string | null;
                /** Format: uuid */
                toStepVersionId: string;
                fromRaw: string;
                toRaw: string;
            };
        };
        InternalMathTransitionResult: {
            /** @enum {string} */
            schemaVersion: "math-internal-v1";
            /** Format: uuid */
            requestId: string;
            engineVersion: string;
            notationProfileVersion: string;
            /**
             * Format: int32
             * @description إصدار محاولة، يعادل bigint في PostgreSQL لكنه مقيد هنا إلى Int32 آمن لواجهات JavaScript.
             * @example 4
             */
            attemptRevision: number;
            status: components["schemas"]["MathStatus"];
            reasonCode: string | null;
            evidence: components["schemas"]["InternalMathEvidence"] | null;
            issue: components["schemas"]["MathIssue"] | null;
        };
        BootstrapEnvelope: {
            data: components["schemas"]["BootstrapData"];
            meta: components["schemas"]["Meta"];
        };
        GuestEnvelope: {
            data: components["schemas"]["GuestCreateData"];
            meta: components["schemas"]["Meta"];
        };
        GuestCurrentEnvelope: {
            data: components["schemas"]["GuestSession"];
            meta: components["schemas"]["Meta"];
        };
        LearningSessionEnvelope: {
            data: components["schemas"]["LearningSession"];
            meta: components["schemas"]["Meta"];
        };
        SkillListEnvelope: {
            data: components["schemas"]["ListSkills"];
            meta: components["schemas"]["Meta"];
        };
        SkillEnvelope: {
            data: components["schemas"]["Skill"];
            meta: components["schemas"]["Meta"];
        };
        ProblemListEnvelope: {
            data: components["schemas"]["ListProblems"];
            meta: components["schemas"]["Meta"];
        };
        ProblemEnvelope: {
            data: components["schemas"]["ProblemDetail"];
            meta: components["schemas"]["Meta"];
        };
        AttemptListEnvelope: {
            data: components["schemas"]["ListAttempts"];
            meta: components["schemas"]["Meta"];
        };
        AttemptEnvelope: {
            data: components["schemas"]["Attempt"];
            meta: components["schemas"]["Meta"];
        };
        StepMutationEnvelope: {
            data: components["schemas"]["StepMutationResult"];
            meta: components["schemas"]["Meta"];
        };
        VerificationEnvelope: {
            data: components["schemas"]["VerificationReport"];
            meta: components["schemas"]["Meta"];
        };
        VerificationDetailEnvelope: {
            data: components["schemas"]["VerificationResultDetail"];
            meta: components["schemas"]["Meta"];
        };
        ProbeEnvelope: {
            data: components["schemas"]["Probe"];
            meta: components["schemas"]["Meta"];
        };
        ProbeAnswerEnvelope: {
            data: components["schemas"]["ProbeEvaluation"];
            meta: components["schemas"]["Meta"];
        };
        HintEnvelope: {
            data: components["schemas"]["TutoringEvent"];
            meta: components["schemas"]["Meta"];
        };
        EpisodeEnvelope: {
            data: components["schemas"]["LearningEpisode"];
            meta: components["schemas"]["Meta"];
        };
        ProgressEnvelope: {
            data: components["schemas"]["ProgressSummary"];
            meta: components["schemas"]["Meta"];
        };
        SkillProgressEnvelope: {
            data: components["schemas"]["SkillProgress"];
            meta: components["schemas"]["Meta"];
        };
        TeacherSummaryEnvelope: {
            data: components["schemas"]["TeacherDemoSummary"];
            meta: components["schemas"]["Meta"];
        };
        TeacherExampleEnvelope: {
            data: components["schemas"]["TeacherDemoExample"];
            meta: components["schemas"]["Meta"];
        };
        HealthEnvelope: {
            data: components["schemas"]["ServiceHealth"];
            meta: components["schemas"]["Meta"];
        };
        AccountUser: {
            /** Format: uuid */
            id: string;
            /** Format: email */
            email: string;
            /** @enum {string} */
            role: "student" | "teacher" | "content_manager" | "admin";
            /** @enum {string} */
            status: "active" | "suspended" | "deletion_requested" | "deleted";
            isInternal: boolean;
        };
        AccountIdentity: {
            user: components["schemas"]["AccountUser"] | null;
            csrfToken: string;
            guestAvailable: boolean;
            loginCsrfToken?: string;
        };
        AccountEmailRequest: {
            /** Format: email */
            email: string;
        };
        AccountEmailVerify: {
            /** Format: email */
            email: string;
            /** Format: uuid */
            challengeId: string;
            code: string;
        };
        AccountClaimInput: {
            /** @constant */
            consent: true;
        };
        AccountDeletionInput: {
            /** @constant */
            confirm: true;
        };
        AccountEmptyInput: Record<string, never>;
        AccountAttempt: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            learningSessionId: string;
            /** Format: uuid */
            problemRevisionId: string;
            /** Format: uuid */
            problemId: string;
            revision: number;
            status: string;
            completionVerdict: string | null;
            /** Format: date-time */
            updatedAt: string;
        };
        AccountSubjectAttempt: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            subjectCode: "physics" | "programming";
            /** Format: uuid */
            problemRevisionId: string;
            revision: number;
            sourceRaw: string;
            answer: unknown;
            verdict: unknown;
            assistanceLevel: number;
            independent: boolean;
            /** Format: date-time */
            updatedAt: string;
        };
        SubjectProgressEvidence: {
            /** @enum {string} */
            subjectCode: "physics" | "programming";
            skillCode: string;
            evidenceCount: number;
            independentCount: number;
            assistedCount: number;
            /** @enum {string} */
            state: "not_assessed" | "new_independent_evidence" | "assisted_evidence" | "needs_review";
            /** Format: date-time */
            updatedAt: string;
        };
        AccountProgress: {
            skills: components["schemas"]["SkillProgress"][];
            subjects: components["schemas"]["SubjectProgressEvidence"][];
            noteAr: string;
        };
        AccountStepExport: {
            /** Format: uuid */
            attemptId: string;
            position: number;
            version: number;
            sourceRaw: string;
            /** Format: date-time */
            createdAt: string;
        };
        BetaFeedbackInput: {
            /** @enum {string} */
            kind: "bug" | "content" | "suggestion" | "other";
            message: string;
            /** Format: uuid */
            requestId?: string;
        };
        BetaFeedback: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            kind: "bug" | "content" | "suggestion" | "other";
            message: string;
            requestId: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        BetaRevokeInput: {
            /** Format: uuid */
            userId: string;
        };
        BetaMetrics: {
            /** Format: date */
            day: string;
            api: {
                requestCount: number;
                sampleCount: number;
                status4xx: number;
                status5xx: number;
                p50Ms: number | null;
                p95Ms: number | null;
            };
            ai: {
                calls: number;
                hintRequests: number;
                fallback: number;
                fallbackRatio: number | null;
                inputTokens: number;
                outputTokens: number;
                estimatedCostMicros: number;
                unknownCostCalls: number;
                timeouts: number;
            };
            mathTimeouts: number;
            /** @description Token counts are provider-reported; monetary amounts are estimates using operator-supplied micro-USD prices, never an invoice. */
            aiCost?: {
                /** @enum {string} */
                status: "estimated" | "unknown" | "mixed" | "not_invoked";
                /** @constant */
                currency: "USD";
                estimatedCalls: number;
                reportedTokenCalls: number;
                unknownTokenCalls: number;
                pricingVersions: string[];
                actualBilledCostMicros: null;
            };
            scope: string;
            percentileMinimumSamples: number;
            usage: {
                sessionsToday: number;
                attemptsToday: number;
                hintsToday: number;
            };
            /** @enum {string} */
            database: "ready" | "unavailable";
            disk: {
                availableBytes: number;
                totalBytes: number;
            } | null;
            feedback: components["schemas"]["BetaFeedback"][];
            limits: {
                dailyCostMicros: number;
                monthlyCostMicros: number;
                userDailyCalls: number;
            };
            noteAr: string;
        };
        AccountCurrentEnvelope: {
            data: components["schemas"]["AccountIdentity"];
            meta: components["schemas"]["Meta"];
        };
        AccountEmailRequestEnvelope: {
            data: {
                /** Format: uuid */
                challengeId: string;
                expiresInSeconds: number;
                resendAfterSeconds: number;
                /** @constant */
                delivery: "queued";
            };
            meta: components["schemas"]["Meta"];
        };
        AccountVerifyEnvelope: {
            data: components["schemas"]["AccountIdentity"];
            meta: components["schemas"]["Meta"];
        };
        AccountLogoutEnvelope: {
            data: {
                /** @constant */
                loggedOut: true;
            };
            meta: components["schemas"]["Meta"];
        };
        AccountClaimEnvelope: {
            data: {
                /** @constant */
                claimed: true;
                learningSessionCount: number;
            };
            meta: components["schemas"]["Meta"];
        };
        AccountAttemptsEnvelope: {
            data: {
                attempts: components["schemas"]["AccountAttempt"][];
                subjectAttempts: components["schemas"]["AccountSubjectAttempt"][];
                nextCursor: null;
            };
            meta: components["schemas"]["Meta"];
        };
        AccountProgressEnvelope: {
            data: components["schemas"]["AccountProgress"];
            meta: components["schemas"]["Meta"];
        };
        AccountDeletionEnvelope: {
            data: {
                /** @constant */
                status: "deletion_requested";
                /** @constant */
                accessRevoked: true;
                noteAr: string;
            };
            meta: components["schemas"]["Meta"];
        };
        AccountExportEnvelope: {
            data: {
                user: components["schemas"]["AccountUser"] | null;
                attempts: components["schemas"]["AccountAttempt"][];
                subjectAttempts: components["schemas"]["AccountSubjectAttempt"][];
                progress: components["schemas"]["AccountProgress"];
                steps: components["schemas"]["AccountStepExport"][];
                /** Format: date-time */
                exportedAt: string;
                limits: {
                    attempts: number;
                    stepVersions: number;
                    subjectAttempts: number;
                };
                noteAr: string;
            };
            meta: components["schemas"]["Meta"];
        };
        BetaFeedbackEnvelope: {
            data: {
                /** Format: uuid */
                id: string;
                /** @constant */
                status: "received";
            };
            meta: components["schemas"]["Meta"];
        };
        BetaMetricsEnvelope: {
            data: components["schemas"]["BetaMetrics"];
            meta: components["schemas"]["Meta"];
        };
        BetaRevokeEnvelope: {
            data: {
                /** @constant */
                revoked: true;
            };
            meta: components["schemas"]["Meta"];
        };
        PhysicsProblem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            problemId: string;
            /** Format: uuid */
            revisionId: string;
            code: string;
            titleAr: string;
            statementAr: string;
            unitCode: string;
            lessonCode: string;
            lessonTitleAr: string;
            skillCodes: string[];
            difficulty: number;
            quantity: string;
            givens: {
                [key: string]: string;
            };
            allowedUnits: string[];
        };
        PhysicsAttempt: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            problemRevisionId: string;
            revision: number;
            /** @enum {string} */
            status: "correct" | "wrong_value" | "wrong_unit" | "unsupported" | "invalid_input" | "service_error";
            valueCorrect: boolean | null;
            unitCorrect: boolean | null;
            messageAr: string;
            diagnosis: {
                /** @enum {string} */
                state: "possible" | "unresolved";
                code: string | null;
                messageAr: string;
            };
            independentEvidence: boolean;
            assistanceLevel: number;
        };
        PhysicsHint: {
            /** Format: uuid */
            attemptId: string;
            revision: number;
            level: number;
            textAr: string;
            /** @enum {string} */
            source: "reviewed_template" | "llm_validated";
            /** @constant */
            independentEvidence: false;
            reasonAr: string;
        };
        PhysicsAttemptInput: {
            /** Format: uuid */
            problemRevisionId: string;
            value: string;
            unit: string;
            /** Format: uuid */
            attemptId?: string;
            expectedRevision?: number;
        };
        PhysicsHintInput: {
            level: number;
            confirmFullSolution?: boolean;
            expectedRevision: number;
        };
        PhysicsProblemEnvelope: {
            data: components["schemas"]["PhysicsProblem"];
            meta: components["schemas"]["Meta"];
        };
        PhysicsProblemListEnvelope: {
            data: {
                items: components["schemas"]["PhysicsProblem"][];
            };
            meta: components["schemas"]["Meta"];
        };
        PhysicsAttemptEnvelope: {
            data: components["schemas"]["PhysicsAttempt"];
            meta: components["schemas"]["Meta"];
        };
        PhysicsHintEnvelope: {
            data: components["schemas"]["PhysicsHint"];
            meta: components["schemas"]["Meta"];
        };
        PhysicsResumeEnvelope: {
            data: {
                problem: components["schemas"]["PhysicsProblem"];
                result: components["schemas"]["PhysicsAttempt"];
                value: string;
                unit: string;
            };
            meta: components["schemas"]["Meta"];
        };
        ProductContentHint: {
            level: number;
            textAr: string;
            /** @enum {string} */
            source: "manual" | "ai_suggested";
            reviewed: boolean;
            errorCode?: ("ERR-ALG-01" | "ERR-ALG-02" | "ERR-ALG-03" | "ERR-ALG-04" | "ERR-ALG-05" | "ERR-ALG-06") | null;
        };
        StudioAlgebraContent: {
            equationRaw: string;
            answerRaw: string;
            validStepRaw: string;
            invalidStepRaw: string;
        };
        StudioPhysicsContent: {
            /** @constant */
            topic: "kinematics_1d";
            /** @enum {string} */
            formula: "constant_speed_distance" | "constant_velocity_displacement" | "average_speed" | "average_velocity" | "final_velocity" | "displacement" | "acceleration" | "elapsed_time";
            /** @enum {string} */
            quantity: "distance" | "displacement" | "speed" | "velocity" | "acceleration" | "time";
            /** @enum {string} */
            expectedDimension: "length" | "time" | "speed" | "acceleration";
            expectedValueSI: string;
            /** @enum {string} */
            expectedUnit: "m" | "s" | "m/s" | "m/s²" | "km/h";
            tolerance: string;
            givens: {
                [key: string]: string;
            };
            constraints?: {
                nonNegativeAnswer: boolean;
            };
        };
        ProgrammingTestCase: {
            input: string;
            expectedOutput: string;
            hidden: boolean;
        };
        StudioProgrammingContent: {
            starterCode: string;
            referenceCode: string;
            tests: components["schemas"]["ProgrammingTestCase"][];
            functionName?: string;
        };
        StudioContentValidation: {
            valid: boolean;
            issues: string[];
            /** Format: date-time */
            checkedAt: string;
            engine: string;
            programming?: components["schemas"]["ProgrammingValidation"];
        };
        ProductPublicAlgebra: {
            equationRaw: string;
        };
        ProductPublicPhysics: {
            givens: {
                [key: string]: string;
            };
            quantity: string;
            units: string[];
        };
        ProductPublicProgramming: {
            starterCode: string;
            publicTests: {
                input: string;
                expectedOutput: string;
            }[];
            functionName?: string;
        };
        ProgrammingSubmitInput: {
            /** Format: uuid */
            problemRevisionId: string;
            sourceRaw: string;
            /** @enum {string} */
            mode: "run" | "submit";
            /** Format: uuid */
            attemptId?: string;
            expectedRevision?: number;
        };
        ProgrammingResult: {
            /** Format: uuid */
            attemptId: string;
            revision: number;
            /** @enum {string} */
            mode: "run" | "submit";
            /** @enum {string} */
            status: "queued" | "running" | "succeeded" | "compile_error" | "runtime_error" | "timeout" | "resource_limit" | "service_error";
            stdout: string;
            stderr: string;
            passed: number;
            total: number;
            allPassed: boolean;
            independent: boolean;
            /** Format: date-time */
            createdAt: string;
        };
        ProgrammingHintInput: {
            level: number;
            confirmFullSolution?: boolean;
            expectedRevision: number;
        };
        ProgrammingHint: {
            /** Format: uuid */
            attemptId: string;
            revision: number;
            level: number;
            textAr: string;
            /** @enum {string} */
            source: "reviewed_template" | "llm_validated";
            reasonAr: string;
        };
        TutoringPlan: {
            /** @enum {string} */
            judgment: "error_verified" | "no_error" | "unknown";
            /** @enum {string} */
            interpretation: "misconception_candidate" | "unknown";
            /** @enum {string} */
            recommendation: "try_step" | "hint_h1" | "hint_h2" | "hint_h3" | "remediation";
            reasonAr: string;
            recentVerifiedErrors: number;
            previousHintLevel: number;
        };
        StudioContentPayload: {
            titleAr: string;
            statementAr: string;
            /** @enum {string} */
            subject: "algebra" | "physics" | "programming";
            unitCode: string;
            unitTitleAr: string;
            lessonCode: string;
            lessonTitleAr: string;
            skillCodes: string[];
            difficulty: number;
            /** @enum {string} */
            kind: "main" | "remediation" | "transfer";
            familyCode: string;
            hints: components["schemas"]["ProductContentHint"][];
            algebra?: components["schemas"]["StudioAlgebraContent"];
            physics?: components["schemas"]["StudioPhysicsContent"];
            programming?: components["schemas"]["StudioProgrammingContent"];
        } & ({
            /** @constant */
            subject?: "algebra";
        } | {
            /** @constant */
            subject?: "physics";
        } | {
            /** @constant */
            subject?: "programming";
        });
        StudioItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            itemId: string;
            version: number;
            editRevision: number;
            /** @enum {string} */
            status: "draft" | "in_review" | "approved" | "published" | "archived";
            payload: components["schemas"]["StudioContentPayload"];
            contentHash: string;
            validation: components["schemas"]["StudioContentValidation"] | null;
            /** Format: date-time */
            createdAt: string;
            reviewedAt: string | null;
            publishedAt: string | null;
        };
        ProductPublicItem: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            itemId: string;
            version: number;
            /** @enum {string} */
            subject: "algebra" | "physics" | "programming";
            titleAr: string;
            statementAr: string;
            unitCode: string;
            lessonCode: string;
            skillCodes: string[];
            difficulty: number;
            /** @enum {string} */
            kind: "main" | "remediation" | "transfer";
            algebra?: components["schemas"]["ProductPublicAlgebra"];
            physics?: components["schemas"]["ProductPublicPhysics"];
            programming?: components["schemas"]["ProductPublicProgramming"];
        };
        ProductCatalog: {
            subjects: {
                /** @enum {string} */
                code: "algebra" | "physics" | "programming";
                titleAr: string;
                units: {
                    code: string;
                    titleAr: string;
                    lessons: {
                        code: string;
                        titleAr: string;
                        items: components["schemas"]["ProductPublicItem"][];
                    }[];
                }[];
            }[];
        };
        StudioImportInput: {
            items: components["schemas"]["StudioContentPayload"][];
        };
        StudioImportPreview: {
            accepted: number;
            rejected: number;
            results: {
                index: number;
                valid: boolean;
                issues: string[];
            }[];
        };
        StudioEditInput: {
            expectedRevision: number;
            payload: components["schemas"]["StudioContentPayload"];
        };
        StudioTransitionInput: {
            expectedRevision: number;
            /** @enum {string} */
            action: "submit" | "approve" | "publish" | "archive" | "revise" | "rollback";
        };
        StudioItemEnvelope: {
            data: components["schemas"]["StudioItem"];
            meta: components["schemas"]["Meta"];
        };
        StudioItemsEnvelope: {
            data: {
                items: components["schemas"]["StudioItem"][];
            };
            meta: components["schemas"]["Meta"];
        };
        StudioPreviewEnvelope: {
            data: components["schemas"]["StudioImportPreview"];
            meta: components["schemas"]["Meta"];
        };
        StudioExportEnvelope: {
            data: {
                /** @constant */
                format: "khotwa-content-v1";
                items: components["schemas"]["StudioContentPayload"][];
                revisionMetadata: {
                    itemIndex: number;
                    /** Format: uuid */
                    revisionId: string;
                    /** Format: uuid */
                    itemId: string;
                    version: number;
                    /** @enum {string} */
                    status: "draft" | "in_review" | "approved" | "published" | "archived";
                    contentHash: string;
                }[];
            };
            meta: components["schemas"]["Meta"];
        };
        ProductCatalogEnvelope: {
            data: components["schemas"]["ProductCatalog"];
            meta: components["schemas"]["Meta"];
        };
        ProductPublicItemEnvelope: {
            data: components["schemas"]["ProductPublicItem"];
            meta: components["schemas"]["Meta"];
        };
        ProductPublicItemListEnvelope: {
            data: {
                items: components["schemas"]["ProductPublicItem"][];
            };
            meta: components["schemas"]["Meta"];
        };
        ProductStartEnvelope: {
            data: {
                /** Format: uuid */
                attemptId: string;
                /** Format: uuid */
                problemId: string;
                /** Format: uuid */
                learningSessionId: string;
            };
            meta: components["schemas"]["Meta"];
        };
        ProgrammingResultEnvelope: {
            data: components["schemas"]["ProgrammingResult"];
            meta: components["schemas"]["Meta"];
        };
        ProgrammingHistoryEnvelope: {
            data: {
                items: components["schemas"]["ProgrammingResult"][];
            };
            meta: components["schemas"]["Meta"];
        };
        ProgrammingAttemptEnvelope: {
            data: {
                problem: components["schemas"]["ProductPublicItem"];
                result: components["schemas"]["ProgrammingResult"];
                sourceRaw: string;
                assistanceLevel: number;
            };
            meta: components["schemas"]["Meta"];
        };
        ProgrammingHintEnvelope: {
            data: components["schemas"]["ProgrammingHint"];
            meta: components["schemas"]["Meta"];
        };
        TutoringPlanEnvelope: {
            data: components["schemas"]["TutoringPlan"];
            meta: components["schemas"]["Meta"];
        };
        AccountAiConsent: {
            enabled: boolean;
            /** @constant */
            policyVersion: "external-ai-v1";
            updatedAt: string | null;
        };
        AccountAiConsentInput: {
            enabled: boolean;
            /** @constant */
            policyVersion?: "external-ai-v1";
        } & unknown;
        AccountAiConsentEnvelope: {
            data: components["schemas"]["AccountAiConsent"];
            meta: components["schemas"]["Meta"];
        };
        AccountLearningConsent: {
            enabled: boolean;
            /** @constant */
            policyVersion: "real-learning-v1";
            updatedAt: string | null;
        };
        AccountLearningConsentInput: {
            enabled: boolean;
            /** @constant */
            policyVersion?: "real-learning-v1";
        } & unknown;
        AccountLearningConsentEnvelope: {
            data: components["schemas"]["AccountLearningConsent"];
            meta: components["schemas"]["Meta"];
        };
        PhysicsLearningInput: {
            expectedRevision: number;
        };
        PhysicsLearningAssignment: {
            /** Format: uuid */
            id: string;
            /** @enum {unknown} */
            phase: "remediation" | "transfer";
            /** Format: uuid */
            attemptId: string;
            problem: components["schemas"]["PhysicsProblem"];
            /** @enum {unknown} */
            status: "assigned" | "completed" | "invalidated";
            independent: boolean;
        };
        PhysicsLearningLoop: {
            episodeId: string | null;
            /** Format: uuid */
            rootAttemptId: string;
            rootRevision: number;
            /** @enum {unknown} */
            state: "not_started" | "remediating" | "awaiting_transfer" | "finished" | "cancelled";
            reasonAr: string;
            assignments: components["schemas"]["PhysicsLearningAssignment"][];
        };
        PhysicsLearningEnvelope: {
            data: components["schemas"]["PhysicsLearningLoop"];
            meta: components["schemas"]["Meta"];
        };
        ProgrammingValidation: {
            /** @enum {string} */
            status: "queued" | "running" | "succeeded" | "compile_error" | "runtime_error" | "timeout" | "resource_limit" | "service_error";
            passed: number;
            total: number;
            allPassed: boolean;
            public: {
                passed: number;
                total: number;
            };
            hidden: {
                passed: number;
                total: number;
            };
            cases: {
                index: number;
                /** @enum {string} */
                visibility: "public" | "hidden";
                /** @enum {string} */
                status: "queued" | "running" | "succeeded" | "compile_error" | "runtime_error" | "timeout" | "resource_limit" | "service_error";
                passed: boolean;
                executed: boolean;
            }[];
        };
        LPLessonBlock: {
            /** @enum {string} */
            type: "paragraph" | "heading" | "math_example" | "worked_steps" | "key_point" | "common_mistake" | "practice_link" | "code_example" | "physics_example";
            textAr: string;
            raw?: string;
            steps?: {
                raw: string;
                explanationAr: string;
            }[];
            code?: string;
            physics?: components["schemas"]["StudioPhysicsContent"];
            problemRevisionId?: string;
        };
        LPLessonPayload: {
            /** @constant */
            kind: "lesson";
            /** @enum {string} */
            subject: "algebra" | "physics" | "programming";
            code: string;
            titleAr: string;
            descriptionAr: string;
            objectives: string[];
            skillCodes: string[];
            prerequisiteSkillCodes: string[];
            prerequisiteLessonIds: string[];
            contentBlocks: components["schemas"]["LPLessonBlock"][];
            practiceProblemRevisionIds: string[];
            assessmentProblemRevisionIds: string[];
            errorCodes: string[];
            mappingPending: string[];
        };
        LPTrackPayload: {
            /** @constant */
            kind: "track";
            /** @enum {string} */
            subject: "algebra" | "physics" | "programming";
            code: string;
            titleAr: string;
            descriptionAr: string;
            units: {
                code: string;
                titleAr: string;
                lessonRevisionIds: string[];
            }[];
        };
        LPLearningContentPayload: components["schemas"]["LPLessonPayload"] | components["schemas"]["LPTrackPayload"];
        LPLearningContentValidation: {
            valid: boolean;
            issues: string[];
            checkedAt: string;
            engine: string;
            examples: {
                blockIndex: number;
                normalizedText: string | null;
                displayAr: string | null;
                ast: {
                    [key: string]: unknown;
                } | null;
                status: string;
                stepStatuses: string[];
            }[];
        };
        LPLearningContentRevision: {
            id: string;
            itemId: string;
            version: number;
            editRevision: number;
            /** @enum {string} */
            status: "draft" | "in_review" | "approved" | "published" | "archived";
            payload: components["schemas"]["LPLearningContentPayload"];
            contentHash: string;
            validation: components["schemas"]["LPLearningContentValidation"] | null;
            createdAt: string;
            reviewedAt: string | null;
            publishedAt: string | null;
        };
        LPLearningBankProblem: {
            revisionId: string;
            problemId: string;
            /** @enum {string} */
            source: "algebra" | "studio";
            /** @enum {string} */
            subject: "algebra" | "physics" | "programming";
            titleAr: string;
            statementAr: string;
            skillCodes: string[];
            primarySkillCode: string;
            difficulty: number;
            /** @enum {string} */
            kind: "main" | "remediation" | "transfer" | "diagnostic";
            familyCode: string;
            equationRaw?: string;
            physics?: {
                quantity: string;
                givens: {
                    [key: string]: string;
                };
                allowedUnits: string[];
            };
            programming?: {
                starterCode: string;
                publicTests: {
                    input: string;
                    expectedOutput: string;
                }[];
            };
        };
        LPLearningTrackDetail: {
            id: string;
            itemId: string;
            version: number;
            editRevision: number;
            /** @enum {string} */
            status: "draft" | "in_review" | "approved" | "published" | "archived";
            payload: components["schemas"]["LPLearningContentPayload"];
            contentHash: string;
            validation: components["schemas"]["LPLearningContentValidation"] | null;
            createdAt: string;
            reviewedAt: string | null;
            publishedAt: string | null;
            lessons: components["schemas"]["LPLearningContentRevision"][];
        };
        LPLearningLessonDetail: {
            id: string;
            itemId: string;
            version: number;
            editRevision: number;
            /** @enum {string} */
            status: "draft" | "in_review" | "approved" | "published" | "archived";
            payload: components["schemas"]["LPLearningContentPayload"];
            contentHash: string;
            validation: components["schemas"]["LPLearningContentValidation"] | null;
            createdAt: string;
            reviewedAt: string | null;
            publishedAt: string | null;
            practiceProblems: components["schemas"]["LPLearningBankProblem"][];
            assessmentProblems: components["schemas"]["LPLearningBankProblem"][];
        };
        LPLearningSkillMap: {
            ruleVersion: string;
            mappingPending: string[];
            skills: {
                skillCode: string;
                titleAr: string;
                prerequisiteSkillCodes: string[];
                lessonRevisionId: string | null;
            }[];
            errors: {
                errorCode: string;
                candidateSkills: string[];
                mappingPending: boolean;
            }[];
        };
        /** @enum {string} */
        LPAssessmentKind: "diagnostic_pretest" | "lesson_check" | "post_remediation" | "practice";
        /** @enum {string} */
        LPLearningEvidenceState: "not_assessed" | "needs_review" | "practicing_with_support" | "independent_evidence" | "insufficient_evidence";
        LPAssessmentQuestion: {
            id: string;
            problem: components["schemas"]["LPLearningBankProblem"];
            attemptId: string | null;
            steps: string[];
            value: string;
            unit: string;
            status: string | null;
            independent: boolean;
            supportLevel: number;
            completed: boolean;
        };
        LPAssessmentSession: {
            id: string;
            revision: number;
            /** @enum {string} */
            subject: "algebra" | "physics" | "programming";
            kind: components["schemas"]["LPAssessmentKind"];
            trackRevisionId: string;
            lessonRevisionId: string | null;
            /** @enum {string} */
            status: "active" | "completed";
            /** @enum {string} */
            mode: "independent" | "practice";
            questions: components["schemas"]["LPAssessmentQuestion"][];
            coverage: {
                requested: number;
                available: number;
                partial: boolean;
                messageAr: string;
            };
            createdAt: string;
        };
        LPLearningSkillEvidence: {
            skillCode: string;
            titleAr: string;
            state: components["schemas"]["LPLearningEvidenceState"];
            independentCorrect: number;
            independentErrors: number;
            assisted: number;
            evidenceIds: string[];
            source: string;
        };
        LPLearningRecommendation: {
            recommendedLessonId: string;
            targetSkillCode: string;
            /** @enum {string} */
            reasonCode: "repeated_independent_error" | "tentative_review" | "prerequisite_review" | "additional_evidence" | "introduction";
            reasonAr: string;
            /** @constant */
            confidence: "tentative";
            evidenceCount: number;
            evidenceIds: string[];
            ruleVersion: string;
            mappingPending: string[];
            /** @constant */
            nextAction: "study_lesson";
            alternatives: {
                lessonRevisionId: string;
                titleAr: string;
            }[];
        };
        LPAssessmentSummary: {
            session: components["schemas"]["LPAssessmentSession"];
            skills: components["schemas"]["LPLearningSkillEvidence"][];
            recommendation: components["schemas"]["LPLearningRecommendation"] | null;
        };
        LPLearningPathProgress: {
            skills: components["schemas"]["LPLearningSkillEvidence"][];
            recommendation: components["schemas"]["LPLearningRecommendation"] | null;
            lessons: {
                lessonRevisionId: string;
                /** @enum {string} */
                state: "not_started" | "viewed" | "practiced" | "independent_evidence";
                viewedAt: string | null;
            }[];
            ruleVersion: string;
        };
        LPLearningContentEnvelope: {
            data: components["schemas"]["LPLearningContentRevision"];
            meta: components["schemas"]["Meta"];
        };
        LPLearningContentListEnvelope: {
            data: {
                items: components["schemas"]["LPLearningContentRevision"][];
            };
            meta: components["schemas"]["Meta"];
        };
        LPLearningTrackEnvelope: {
            data: components["schemas"]["LPLearningTrackDetail"];
            meta: components["schemas"]["Meta"];
        };
        LPLearningLessonEnvelope: {
            data: components["schemas"]["LPLearningLessonDetail"];
            meta: components["schemas"]["Meta"];
        };
        LPLearningSkillMapEnvelope: {
            data: components["schemas"]["LPLearningSkillMap"];
            meta: components["schemas"]["Meta"];
        };
        LPLearningBankEnvelope: {
            data: {
                items: components["schemas"]["LPLearningBankProblem"][];
            };
            meta: components["schemas"]["Meta"];
        };
        LPExpectedRevisionInput: {
            expectedRevision: number;
        };
        LPLearningEditInput: {
            expectedRevision: number;
            payload: components["schemas"]["LPLearningContentPayload"];
        };
        LPLearningTransitionInput: {
            expectedRevision: number;
            /** @enum {string} */
            action: "submit" | "approve" | "publish" | "archive" | "revise";
        };
        LPLessonProgressInput: {
            /** @enum {string} */
            event: "lesson_started" | "lesson_viewed";
        };
        LPAssessmentEnvelope: {
            data: components["schemas"]["LPAssessmentSession"];
            meta: components["schemas"]["Meta"];
        };
        LPAssessmentSummaryEnvelope: {
            data: components["schemas"]["LPAssessmentSummary"];
            meta: components["schemas"]["Meta"];
        };
        LPLearningProgressEnvelope: {
            data: components["schemas"]["LPLearningPathProgress"];
            meta: components["schemas"]["Meta"];
        };
        LPLearningRecommendationEnvelope: {
            data: {
                skills: components["schemas"]["LPLearningSkillEvidence"][];
                recommendation: components["schemas"]["LPLearningRecommendation"] | null;
            };
            meta: components["schemas"]["Meta"];
        };
        LPAssessmentSupportEnvelope: {
            data: {
                session: components["schemas"]["LPAssessmentSession"];
                hint: {
                    /** @enum {string} */
                    level: "H1" | "H2" | "H3" | "H4";
                    textAr: string;
                    source: string;
                    solutionStepsAr: string[];
                };
            };
            meta: components["schemas"]["Meta"];
        };
        LPLessonProgressEnvelope: {
            data: {
                /** Format: uuid */
                lessonRevisionId: string;
                /** @constant */
                state: "viewed";
                /** Format: date-time */
                viewedAt: string;
            };
            meta: components["schemas"]["Meta"];
        };
        LPAssessmentStartInput: {
            /** Format: uuid */
            trackRevisionId: string;
            /** Format: uuid */
            lessonRevisionId?: string;
            kind: components["schemas"]["LPAssessmentKind"];
        };
        LPAssessmentAnswerInput: {
            expectedRevision: number;
            /** Format: uuid */
            questionId: string;
            steps: string[];
            value?: string;
            unit?: string;
        };
        LPAssessmentSupportInput: {
            expectedRevision: number;
            /** Format: uuid */
            questionId: string;
            /** @enum {string} */
            action: "request_hint" | "show_full_solution";
            /** @constant */
            confirmAssistedCompletion?: true;
        };
    };
    responses: {
        /** @description طلب JSON غير صالح أو رأس مفقود. */
        E400: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description جلسة ضيف غير موجودة أو انتهت. */
        E401: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description جلسة مصادق عليها لكن الإجراء غير مسموح. */
        E403: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description المورد غير موجود أو ليس ضمن ملكية الجلسة. */
        E404: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description تعارض إصدار أو مفتاح تكرار أو حالة سير العمل. */
        E409: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description جلسة أبطلت أو محتوى لم يعد صالحًا وفق السياسة. */
        E410: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description مدخلات صحيحة JSON لكنها تخالف قيود DTO أو سياسة العملية. */
        E422: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description حد الطلبات تجاوز الحدود المعتمدة. */
        E429: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                /** @description ثوانٍ أو وقت HTTP عند انطباقه. */
                "Retry-After"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description خدمة معتمدة غير متاحة؛ لا يصنَّف الطالب مخطئًا. */
        E503: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                /** @description ثوانٍ أو وقت HTTP عند انطباقه. */
                "Retry-After"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
        /** @description عطل خادمي غير متوقع. */
        E500: {
            headers: {
                /** @description معرّف تتبع يصلح للدعم دون مشاركة بيانات الطالب. */
                "X-Request-Id"?: string;
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorEnvelope"];
            };
        };
    };
    parameters: {
        /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
        AttemptId: string;
        StepId: string;
        SkillId: string;
        ProblemId: string;
        LearningSessionId: string;
        EpisodeId: string;
        ProbeId: string;
        VerificationResultId: string;
        ExampleId: string;
        /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
        Csrf: string;
        /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
        Idempotency: string;
        /** @description مؤشر صفحات معتم؛ لا تفسره الواجهة. */
        Cursor: string;
        Limit: number;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getBootstrap: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    "Cache-Control"?: string;
                    /** @description ملف ارتباط تمهيدي مُوقّع خاص بـCSRF، وليس جلسة طالب. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BootstrapEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    createGuestSession: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
            };
            path?: never;
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateGuestInput"];
            };
        };
        responses: {
            /** @description الجلسة الموجودة صالحة وأُعيدت دون تكرار. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GuestEnvelope"];
                };
            };
            /** @description تم إنشاء جلسة ضيف. */
            201: {
                headers: {
                    /** @description kh_guest بخصائص HttpOnly وSecure وSameSite؛ لا يُرجع السر في JSON. */
                    "Set-Cookie"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GuestEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            403: components["responses"]["E403"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getCurrentGuestSession: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["GuestCurrentEnvelope"];
                };
            };
            401: components["responses"]["E401"];
            410: components["responses"]["E410"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    revokeGuestSession: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية بلا جسم. */
            204: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            409: components["responses"]["E409"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    createLearningSession: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateLearningSessionInput"];
            };
        };
        responses: {
            /** @description أُنشئت جلسة تعلم. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LearningSessionEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getLearningSession: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                learningSessionId: components["parameters"]["LearningSessionId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LearningSessionEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    listSkills: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SkillListEnvelope"];
                };
            };
            401: components["responses"]["E401"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getSkill: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                skillId: components["parameters"]["SkillId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SkillEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    listProblems: {
        parameters: {
            query: {
                /** @description الفلتر الإلزامي لمنع عرض مواد خارج نطاق المهارة. */
                skillId: string;
                /** @description مؤشر صفحات معتم؛ لا تفسره الواجهة. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemListEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getProblem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                problemId: components["parameters"]["ProblemId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    listAttempts: {
        parameters: {
            query: {
                learningSessionId: string;
                /** @description مؤشر صفحات معتم؛ لا تفسره الواجهة. */
                cursor?: components["parameters"]["Cursor"];
                limit?: components["parameters"]["Limit"];
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttemptListEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    createAttempt: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAttemptInput"];
            };
        };
        responses: {
            /** @description أُنشئت محاولة. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttemptEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getAttempt: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AttemptEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    createStep: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateStepInput"];
            };
        };
        responses: {
            /** @description أُنشئت الخطوة؛ أُعيد رقم مراجعة المحاولة الجديد. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StepMutationEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    updateStep: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
                stepId: components["parameters"]["StepId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["EditStepInput"];
            };
        };
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StepMutationEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    deleteStep: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
                stepId: components["parameters"]["StepId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["DeleteStepInput"];
            };
        };
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StepMutationEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    verifyAttempt: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["VerifyInput"];
            };
        };
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            /** @description تعارض رقم مراجعة أو مفتاح تكرار أو نتيجة قديمة. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorEnvelope"];
                };
            };
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getVerificationResult: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
                verificationResultId: components["parameters"]["VerificationResultId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["VerificationDetailEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    createDiagnosticProbe: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["RequestProbeInput"];
            };
        };
        responses: {
            /** @description أُنشئ سؤال تأكيدي. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProbeEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    answerDiagnosticProbe: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
                probeId: components["parameters"]["ProbeId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["AnswerProbeInput"];
            };
        };
        responses: {
            /** @description حُفظت إجابة السؤال التأكيدي. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProbeAnswerEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    requestHint: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["HintInput"];
            };
        };
        responses: {
            /** @description سُجل حدث المساعدة. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HintEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    startRemediation: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["StartRemediationInput"];
            };
        };
        responses: {
            /** @description الحلقة النشطة موجودة وأُعيدت دون مضاعفة. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EpisodeEnvelope"];
                };
            };
            /** @description أُنشئت أو أعيدت حلقة العلاج. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EpisodeEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    startTransferCheck: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                /** @description هوية المحاولة؛ لا تُعد دليل ملكية. */
                attemptId: components["parameters"]["AttemptId"];
            };
            cookie?: never;
        };
        /** @description حمولة JSON ذات مخطط مضبوط. المقادير الرياضية لا تُرسل كـ AST غير موثوقة. */
        requestBody: {
            content: {
                "application/json": components["schemas"]["StartTransferInput"];
            };
        };
        responses: {
            /** @description أُسندت مسألة النقل. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EpisodeEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getLearningEpisode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                episodeId: components["parameters"]["EpisodeId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EpisodeEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getProgress: {
        parameters: {
            query: {
                learningSessionId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProgressEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getSkillProgress: {
        parameters: {
            query: {
                learningSessionId: string;
            };
            header?: never;
            path: {
                skillId: components["parameters"]["SkillId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SkillProgressEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getTeacherDemoSummary: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeacherSummaryEnvelope"];
                };
            };
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getTeacherDemoExample: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                exampleId: components["parameters"]["ExampleId"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TeacherExampleEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
        };
    };
    getNestLiveHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthEnvelope"];
                };
            };
            403: components["responses"]["E403"];
            500: components["responses"]["E500"];
        };
    };
    getNestReadyHealth: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description تمت العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthEnvelope"];
                };
            };
            403: components["responses"]["E403"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_me_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountCurrentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_me_delete: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountDeletionInput"];
            };
        };
        responses: {
            /** @description نجاح */
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountDeletionEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_auth_email_request_post: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountEmailRequest"];
            };
        };
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountEmailRequestEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_auth_email_verify_post: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountEmailVerify"];
            };
        };
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountVerifyEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_auth_logout_post: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountEmptyInput"];
            };
        };
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountLogoutEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_me_claim_guest_post: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountClaimInput"];
            };
        };
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountClaimEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_me_attempts_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountAttemptsEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_me_progress_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountProgressEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_me_export_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountExportEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_beta_feedback_post: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BetaFeedbackInput"];
            };
        };
        responses: {
            /** @description نجاح */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BetaFeedbackEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_beta_metrics_get: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BetaMetricsEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    product_api_v1_beta_access_revoke_post: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["BetaRevokeInput"];
            };
        };
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BetaRevokeEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    listPhysicsProblems: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة موثوقة من NestJS دون مفتاح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhysicsProblemListEnvelope"];
                };
            };
            /** @description جلسة غير صالحة */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description أصل الطلب أو CSRF غير صالح */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مورد غير متاح */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مراجعة قديمة أو مفتاح متعارض */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مدخل غير صالح */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description تعذر المحرك أو التلميح المراجع */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    getPhysicsProblem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة موثوقة من NestJS دون مفتاح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhysicsProblemEnvelope"];
                };
            };
            /** @description جلسة غير صالحة */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description أصل الطلب أو CSRF غير صالح */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مورد غير متاح */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مراجعة قديمة أو مفتاح متعارض */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مدخل غير صالح */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description تعذر المحرك أو التلميح المراجع */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    submitPhysicsAnswer: {
        parameters: {
            query?: never;
            header: {
                "X-CSRF-Token": string;
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhysicsAttemptInput"];
            };
        };
        responses: {
            /** @description استجابة موثوقة من NestJS دون مفتاح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhysicsAttemptEnvelope"];
                };
            };
            /** @description جلسة غير صالحة */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description أصل الطلب أو CSRF غير صالح */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مورد غير متاح */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مراجعة قديمة أو مفتاح متعارض */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مدخل غير صالح */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description تعذر المحرك أو التلميح المراجع */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    requestPhysicsHint: {
        parameters: {
            query?: never;
            header: {
                "X-CSRF-Token": string;
                "Idempotency-Key": string;
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhysicsHintInput"];
            };
        };
        responses: {
            /** @description استجابة موثوقة من NestJS دون مفتاح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhysicsHintEnvelope"];
                };
            };
            /** @description جلسة غير صالحة */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description أصل الطلب أو CSRF غير صالح */
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مورد غير متاح */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مراجعة قديمة أو مفتاح متعارض */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description مدخل غير صالح */
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description تعذر المحرك أو التلميح المراجع */
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    resumePhysicsAttempt: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استعادة محاولة يملكها المستخدم مع نسخة السؤال المثبتة */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhysicsResumeEnvelope"];
                };
            };
            /** @description جلسة غير صالحة */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            /** @description محاولة غير متاحة */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    listStudioItems: {
        parameters: {
            query?: {
                subject?: string;
                status?: string;
                q?: string;
                skillCode?: string;
                difficulty?: "1" | "2" | "3";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioItemsEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    createStudioDraft: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StudioContentPayload"];
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioItemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getStudioRevision: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioItemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    editStudioDraft: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StudioEditInput"];
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioItemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    deleteStudioDraft: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: number;
                };
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioItemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    validateStudioRevision: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": {
                    expectedRevision: number;
                };
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioItemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    transitionStudioRevision: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StudioTransitionInput"];
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioItemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    previewStudioImport: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StudioImportInput"];
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioPreviewEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    importStudioDrafts: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["StudioImportInput"];
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioItemsEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    exportStudioContent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["StudioExportEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getProductCatalog: {
        parameters: {
            query?: {
                subject?: "algebra" | "physics" | "programming";
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductCatalogEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getPublishedProductProblem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductPublicItemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    startPublishedStudioAlgebra: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductStartEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    listProgrammingProblems: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductPublicItemListEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getProgrammingProblem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductPublicItemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    listProgrammingAttempts: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProgrammingHistoryEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    submitProgrammingCode: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProgrammingSubmitInput"];
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProgrammingResultEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getProgrammingAttempt: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProgrammingAttemptEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getProgrammingHint: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProgrammingHintInput"];
            };
        };
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProgrammingHintEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getAdaptiveTutoringPlan: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["TutoringPlanEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getAttemptPinnedProblem: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description استجابة NestJS موثوقة؛ بيانات الطالب لا تحتوي مفاتيح الحل */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProblemEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getAccountAiConsent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountAiConsentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    setAccountAiConsent: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountAiConsentInput"];
            };
        };
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountAiConsentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getAccountLearningConsent: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountLearningConsentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    setAccountLearningConsent: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["AccountLearningConsentInput"];
            };
        };
        responses: {
            /** @description نجاح */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AccountLearningConsentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    getPhysicsLearningLoop: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description إسنادات فيزياء مملوكة مرتبطة بإصدار الأصل؛ النقل مستقل بلا تلميحات */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhysicsLearningEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    startPhysicsRemediation: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhysicsLearningInput"];
            };
        };
        responses: {
            /** @description إسنادات فيزياء مملوكة مرتبطة بإصدار الأصل؛ النقل مستقل بلا تلميحات */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhysicsLearningEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    startPhysicsTransfer: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PhysicsLearningInput"];
            };
        };
        responses: {
            /** @description إسنادات فيزياء مملوكة مرتبطة بإصدار الأصل؛ النقل مستقل بلا تلميحات */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PhysicsLearningEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetLearningTracks: {
        parameters: {
            query?: {
                subject?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningContentListEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetLearningTracksId: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningTrackEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetLearningLessonsId: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningLessonEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetLearningSkillMap: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningSkillMapEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetStudioLearningContent: {
        parameters: {
            query?: {
                subject?: string;
                kind?: string;
                status?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningContentListEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PostStudioLearningContent: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LPLearningContentPayload"];
            };
        };
        responses: {
            /** @description نجاح العملية. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningContentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetStudioLearningContentId: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningContentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PutStudioLearningContentId: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LPLearningEditInput"];
            };
        };
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningContentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PostStudioLearningContentIdValidate: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LPExpectedRevisionInput"];
            };
        };
        responses: {
            /** @description نجاح العملية. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningContentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PostStudioLearningContentIdTransition: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LPLearningTransitionInput"];
            };
        };
        responses: {
            /** @description نجاح العملية. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningContentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetStudioLearningBank: {
        parameters: {
            query?: {
                subject?: string;
                skillCode?: string;
                difficulty?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningBankEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PostStudioLearningContentSeed: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": Record<string, never>;
            };
        };
        responses: {
            /** @description نجاح العملية. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningContentListEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PostAssessmentsStart: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LPAssessmentStartInput"];
            };
        };
        responses: {
            /** @description نجاح العملية. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPAssessmentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetAssessmentsId: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPAssessmentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PostAssessmentsIdAnswer: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LPAssessmentAnswerInput"];
            };
        };
        responses: {
            /** @description نجاح العملية. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPAssessmentEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PostAssessmentsIdSupport: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LPAssessmentSupportInput"];
            };
        };
        responses: {
            /** @description نجاح العملية. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPAssessmentSupportEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetAssessmentsIdSummary: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPAssessmentSummaryEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetRecommendationsNext: {
        parameters: {
            query: {
                trackRevisionId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningRecommendationEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22PostLearningLessonsIdProgress: {
        parameters: {
            query?: never;
            header: {
                /** @description رمز CSRF مستخرج من bootstrap؛ مطلوب مع cookies لجميع العمليات المحدثة. */
                "X-CSRF-Token": components["parameters"]["Csrf"];
                /** @description مفتاح فريد للعملية؛ إعادة المفتاح مع الحمولة نفسها تعيد نتيجة العملية دون تكرار الآثار. يُحفظ ملخصه فقط. */
                "Idempotency-Key": components["parameters"]["Idempotency"];
            };
            path: {
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["LPLessonProgressInput"];
            };
        };
        responses: {
            /** @description نجاح العملية. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLessonProgressEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
    v22GetLearningProgress: {
        parameters: {
            query: {
                trackRevisionId: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description نجاح العملية. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["LPLearningProgressEnvelope"];
                };
            };
            400: components["responses"]["E400"];
            401: components["responses"]["E401"];
            403: components["responses"]["E403"];
            404: components["responses"]["E404"];
            409: components["responses"]["E409"];
            422: components["responses"]["E422"];
            429: components["responses"]["E429"];
            500: components["responses"]["E500"];
            503: components["responses"]["E503"];
        };
    };
}
